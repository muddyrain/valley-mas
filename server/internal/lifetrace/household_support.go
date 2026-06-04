package lifetrace

import (
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"
	"valley-server/internal/database"
	"valley-server/internal/model"
	"valley-server/internal/utils"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var errHouseholdNotAccessible = errors.New("household not accessible")

const (
	householdKindPersonal = "personal"
	householdKindShared   = "shared"

	householdStatusActive    = "active"
	householdStatusDissolved = "dissolved"

	householdRoleOwner  = "owner"
	householdRoleAdmin  = "admin"
	householdRoleMember = "member"

	householdMemberStatusActive  = "active"
	householdMemberStatusLeft    = "left"
	householdMemberStatusRemoved = "removed"

	householdInviteStatusPending  = "pending"
	householdInviteStatusAccepted = "accepted"
	householdInviteStatusExpired  = "expired"
	householdInviteStatusRevoked  = "revoked"
)

type householdContext struct {
	Household model.Household
	Member    model.HouseholdMember
}

type householdSummary struct {
	ID          model.Int64String `json:"id"`
	Name        string            `json:"name"`
	Kind        string            `json:"kind"`
	Status      string            `json:"status"`
	OwnerUserID model.Int64String `json:"ownerUserId"`
	Role        string            `json:"role"`
	MemberCount int64             `json:"memberCount"`
}

func personalHouseholdID(userID model.Int64String) model.Int64String {
	return model.Int64String(-int64(userID))
}

func isDuplicateHouseholdCreateError(err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, gorm.ErrDuplicatedKey) {
		return true
	}
	lower := strings.ToLower(err.Error())
	return strings.Contains(lower, "duplicate entry") ||
		strings.Contains(lower, "duplicate key value") ||
		strings.Contains(lower, "duplicated key") ||
		strings.Contains(lower, "unique constraint failed")
}

func reconcilePersonalHousehold(tx *gorm.DB, userID model.Int64String) (model.Household, model.HouseholdMember, error) {
	var households []model.Household
	if err := tx.
		Where("owner_user_id = ? AND kind = ? AND status = ?", userID, householdKindPersonal, householdStatusActive).
		Order(clause.Expr{
			SQL:  "CASE WHEN id = ? THEN 0 ELSE 1 END",
			Vars: []interface{}{personalHouseholdID(userID)},
		}).
		Order("created_at ASC").
		Find(&households).Error; err != nil {
		return model.Household{}, model.HouseholdMember{}, err
	}

	now := time.Now()
	if len(households) == 0 {
		household := model.Household{
			ID:          personalHouseholdID(userID),
			Name:        "我的空间",
			Kind:        householdKindPersonal,
			OwnerUserID: userID,
			Status:      householdStatusActive,
		}
		member := model.HouseholdMember{
			HouseholdID: household.ID,
			UserID:      userID,
			Role:        householdRoleOwner,
			Status:      householdMemberStatusActive,
			JoinedAt:    &now,
		}
		if err := tx.Create(&household).Error; err != nil {
			return household, model.HouseholdMember{}, err
		}
		if err := tx.Create(&member).Error; err != nil {
			return household, model.HouseholdMember{}, err
		}
		return household, member, backfillUserPantryHousehold(tx, userID, household.ID)
	}

	primary := households[0]
	if primary.Name == "" || primary.Name != "我的空间" {
		if err := tx.Model(&model.Household{}).
			Where("id = ?", primary.ID).
			Updates(map[string]interface{}{
				"name":   "我的空间",
				"status": householdStatusActive,
			}).Error; err != nil {
			return model.Household{}, model.HouseholdMember{}, err
		}
		primary.Name = "我的空间"
		primary.Status = householdStatusActive
	}

	var duplicateIDs []model.Int64String
	if len(households) > 1 {
		duplicateIDs = make([]model.Int64String, 0, len(households)-1)
		for _, item := range households[1:] {
			duplicateIDs = append(duplicateIDs, item.ID)
		}
	}

	if len(duplicateIDs) > 0 {
		if err := tx.Model(&model.LifeTracePantryItem{}).
			Where("household_id IN ?", duplicateIDs).
			Update("household_id", primary.ID).Error; err != nil {
			return model.Household{}, model.HouseholdMember{}, err
		}

		var duplicateMembers []model.HouseholdMember
		if err := tx.
			Where("household_id IN ? AND status = ?", duplicateIDs, householdMemberStatusActive).
			Find(&duplicateMembers).Error; err != nil {
			return model.Household{}, model.HouseholdMember{}, err
		}

		for _, member := range duplicateMembers {
			var existing model.HouseholdMember
			err := tx.
				Where("household_id = ? AND user_id = ? AND status = ?", primary.ID, member.UserID, householdMemberStatusActive).
				First(&existing).Error
			if errors.Is(err, gorm.ErrRecordNotFound) {
				newMember := member
				newMember.ID = 0
				newMember.HouseholdID = primary.ID
				if newMember.JoinedAt == nil {
					newMember.JoinedAt = &now
				}
				if newMember.UserID == userID {
					newMember.Role = householdRoleOwner
				}
				if err := tx.Create(&newMember).Error; err != nil && !errors.Is(err, gorm.ErrDuplicatedKey) {
					return model.Household{}, model.HouseholdMember{}, err
				}
				continue
			}
			if err != nil {
				return model.Household{}, model.HouseholdMember{}, err
			}

			nextRole := existing.Role
			if member.UserID == userID {
				nextRole = householdRoleOwner
			} else if existing.Role == householdRoleMember && (member.Role == householdRoleAdmin || member.Role == householdRoleOwner) {
				nextRole = householdRoleAdmin
			}
			if nextRole != existing.Role {
				if err := tx.Model(&model.HouseholdMember{}).
					Where("id = ?", existing.ID).
					Update("role", nextRole).Error; err != nil {
					return model.Household{}, model.HouseholdMember{}, err
				}
			}
		}

		if err := tx.Where("household_id IN ?", duplicateIDs).Delete(&model.HouseholdMember{}).Error; err != nil {
			return model.Household{}, model.HouseholdMember{}, err
		}
		if err := tx.Where("household_id IN ?", duplicateIDs).Delete(&model.HouseholdInvite{}).Error; err != nil {
			return model.Household{}, model.HouseholdMember{}, err
		}
		if err := tx.Where("id IN ?", duplicateIDs).Delete(&model.Household{}).Error; err != nil {
			return model.Household{}, model.HouseholdMember{}, err
		}
	}

	var member model.HouseholdMember
	memberErr := tx.
		Where("household_id = ? AND user_id = ? AND status = ?", primary.ID, userID, householdMemberStatusActive).
		First(&member).Error
	if errors.Is(memberErr, gorm.ErrRecordNotFound) {
		member = model.HouseholdMember{
			HouseholdID: primary.ID,
			UserID:      userID,
			Role:        householdRoleOwner,
			Status:      householdMemberStatusActive,
			JoinedAt:    &now,
		}
		if err := tx.Create(&member).Error; err != nil {
			return model.Household{}, model.HouseholdMember{}, err
		}
	} else if memberErr != nil {
		return model.Household{}, model.HouseholdMember{}, memberErr
	} else if member.Role != householdRoleOwner {
		if err := tx.Model(&model.HouseholdMember{}).
			Where("id = ?", member.ID).
			Update("role", householdRoleOwner).Error; err != nil {
			return model.Household{}, model.HouseholdMember{}, err
		}
		member.Role = householdRoleOwner
	}

	if err := backfillUserPantryHousehold(tx, userID, primary.ID); err != nil {
		return model.Household{}, model.HouseholdMember{}, err
	}
	return primary, member, nil
}

func ensurePersonalHousehold(userID model.Int64String) (model.Household, model.HouseholdMember, error) {
	db := database.GetDB()
	var household model.Household
	var member model.HouseholdMember

	resolveOnce := func() error {
		return db.Transaction(func(tx *gorm.DB) error {
			resolvedHousehold, resolvedMember, err := reconcilePersonalHousehold(tx, userID)
			if err != nil {
				return err
			}
			household = resolvedHousehold
			member = resolvedMember
			return nil
		})
	}

	err := resolveOnce()
	if isDuplicateHouseholdCreateError(err) {
		err = resolveOnce()
	}
	if err != nil {
		return model.Household{}, model.HouseholdMember{}, err
	}

	if household.ID == 0 || member.ID == 0 {
		err = resolveOnce()
	}
	if err != nil {
		return model.Household{}, model.HouseholdMember{}, err
	}
	return household, member, nil
}

func backfillUserPantryHousehold(tx *gorm.DB, userID, householdID model.Int64String) error {
	return tx.Model(&model.LifeTracePantryItem{}).
		Where("user_id = ? AND (household_id IS NULL OR household_id = 0)", userID).
		Updates(map[string]interface{}{
			"household_id": householdID,
			"created_by":   gorm.Expr("CASE WHEN created_by IS NULL OR created_by = 0 THEN ? ELSE created_by END", userID),
			"updated_by":   gorm.Expr("CASE WHEN updated_by IS NULL OR updated_by = 0 THEN ? ELSE updated_by END", userID),
		}).Error
}

func resolveRequestedHouseholdID(c *gin.Context) model.Int64String {
	raw := strings.TrimSpace(c.Query("householdId"))
	if raw == "" {
		raw = strings.TrimSpace(c.Param("householdId"))
	}
	if raw == "" {
		return 0
	}
	value, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || value <= 0 {
		return 0
	}
	return model.Int64String(value)
}

func normalizePreferredPantryHouseholdID(userID model.Int64String, raw string) model.Int64String {
	preferredID, err := resolvePreferredPantryHouseholdID(userID, raw)
	if err != nil {
		return 0
	}
	return preferredID
}

func loadPreferredPantryHouseholdID(userID model.Int64String) model.Int64String {
	settings, err := findSettings(userID)
	if err != nil {
		return 0
	}
	if settings.ActivePantryHouseholdID <= 0 {
		return 0
	}
	return settings.ActivePantryHouseholdID
}

func resolveHouseholdContext(c *gin.Context, userID model.Int64String) (householdContext, error) {
	personalHousehold, personalMember, err := ensurePersonalHousehold(userID)
	if err != nil {
		return householdContext{}, err
	}

	requestedID := resolveRequestedHouseholdID(c)
	explicitRequest := requestedID != 0
	if requestedID == 0 {
		requestedID = loadPreferredPantryHouseholdID(userID)
	}
	if requestedID == 0 || requestedID == personalHousehold.ID {
		return householdContext{
			Household: personalHousehold,
			Member:    personalMember,
		}, nil
	}

	var household model.Household
	if err := database.GetDB().
		Where("id = ? AND status = ?", requestedID, householdStatusActive).
		First(&household).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			if !explicitRequest {
				return householdContext{
					Household: personalHousehold,
					Member:    personalMember,
				}, nil
			}
			return householdContext{}, fmt.Errorf("%w: 家庭不存在或不可访问", errHouseholdNotAccessible)
		}
		return householdContext{}, err
	}

	var member model.HouseholdMember
	if err := database.GetDB().
		Where("household_id = ? AND user_id = ? AND status = ?", household.ID, userID, householdMemberStatusActive).
		First(&member).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			if !explicitRequest {
				return householdContext{
					Household: personalHousehold,
					Member:    personalMember,
				}, nil
			}
			return householdContext{}, fmt.Errorf("%w: 家庭不存在或不可访问", errHouseholdNotAccessible)
		}
		return householdContext{}, err
	}

	return householdContext{
		Household: household,
		Member:    member,
	}, nil
}

func listHouseholdSummaries(userID model.Int64String) ([]householdSummary, error) {
	if _, _, err := ensurePersonalHousehold(userID); err != nil {
		return nil, err
	}

	type row struct {
		ID          model.Int64String
		Name        string
		Kind        string
		Status      string
		OwnerUserID model.Int64String
		Role        string
		MemberCount int64
	}

	var rows []row
	err := database.GetDB().
		Table("households").
		Select(`
households.id,
households.name,
households.kind,
households.status,
households.owner_user_id,
household_members.role,
COUNT(active_members.id) AS member_count
`).
		Joins("JOIN household_members ON household_members.household_id = households.id AND household_members.user_id = ? AND household_members.status = ?", userID, householdMemberStatusActive).
		Joins("LEFT JOIN household_members AS active_members ON active_members.household_id = households.id AND active_members.status = ? AND active_members.deleted_at IS NULL", householdMemberStatusActive).
		Where("households.deleted_at IS NULL AND households.status != ?", householdStatusDissolved).
		Group("households.id, households.name, households.kind, households.status, households.owner_user_id, household_members.role").
		Order("CASE WHEN households.kind = 'personal' THEN 0 ELSE 1 END").
		Order("households.created_at ASC").
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}

	result := make([]householdSummary, 0, len(rows))
	for _, item := range rows {
		result = append(result, householdSummary{
			ID:          item.ID,
			Name:        item.Name,
			Kind:        item.Kind,
			Status:      item.Status,
			OwnerUserID: item.OwnerUserID,
			Role:        item.Role,
			MemberCount: item.MemberCount,
		})
	}
	return result, nil
}

func generateHouseholdInviteCode() string {
	return "HH" + strings.ToUpper(strconv.FormatInt(utils.GenerateID(), 36))
}
