package lifetrace

import (
	"errors"
	"net/http"
	"strings"
	"time"
	"valley-server/internal/database"
	"valley-server/internal/model"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type createHouseholdRequest struct {
	Name string `json:"name"`
}

type joinHouseholdRequest struct {
	InviteCode string `json:"inviteCode"`
}

type transferHouseholdOwnerRequest struct {
	TargetUserID model.Int64String `json:"targetUserId"`
}

type householdMemberPayload struct {
	ID          model.Int64String `json:"id"`
	HouseholdID model.Int64String `json:"householdId"`
	UserID      model.Int64String `json:"userId"`
	Role        string            `json:"role"`
	Status      string            `json:"status"`
	JoinedAt    *time.Time        `json:"joinedAt,omitempty"`
	LeftAt      *time.Time        `json:"leftAt,omitempty"`
}

func householdSummaryFromContext(ctx householdContext, memberCount int64) householdSummary {
	return householdSummary{
		ID:          ctx.Household.ID,
		Name:        ctx.Household.Name,
		Kind:        ctx.Household.Kind,
		Status:      ctx.Household.Status,
		OwnerUserID: ctx.Household.OwnerUserID,
		Role:        ctx.Member.Role,
		MemberCount: memberCount,
	}
}

func activeHouseholdMemberCount(householdID model.Int64String) (int64, error) {
	var count int64
	err := database.GetDB().
		Model(&model.HouseholdMember{}).
		Where("household_id = ? AND status = ?", householdID, householdMemberStatusActive).
		Count(&count).Error
	return count, err
}

func readHouseholdContext(c *gin.Context, userID model.Int64String) (householdContext, bool) {
	ctx, err := resolveHouseholdContext(c, userID)
	if err == nil {
		return ctx, true
	}
	if errors.Is(err, errHouseholdNotAccessible) {
		fail(c, http.StatusForbidden, "家庭不存在或不可访问")
		return householdContext{}, false
	}
	fail(c, http.StatusInternalServerError, "读取家庭失败")
	return householdContext{}, false
}

func normalizeHouseholdName(name string) string {
	name = strings.TrimSpace(name)
	if name == "" {
		return ""
	}
	if len([]rune(name)) > 40 {
		return string([]rune(name)[:40])
	}
	return name
}

func (h *Handler) ListHouseholds(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	summaries, err := listHouseholdSummaries(userID)
	if err != nil {
		fail(c, http.StatusInternalServerError, "读取家庭列表失败")
		return
	}

	ctx, ok := readHouseholdContext(c, userID)
	if !ok {
		return
	}

	success(c, gin.H{
		"list":               summaries,
		"currentHouseholdId": ctx.Household.ID,
	})
}

func (h *Handler) GetHousehold(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	ctx, ok := readHouseholdContext(c, userID)
	if !ok {
		return
	}

	memberCount, err := activeHouseholdMemberCount(ctx.Household.ID)
	if err != nil {
		fail(c, http.StatusInternalServerError, "读取家庭失败")
		return
	}

	success(c, householdSummaryFromContext(ctx, memberCount))
}

func (h *Handler) CreateHousehold(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	var req createHouseholdRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, http.StatusBadRequest, "参数错误")
		return
	}

	name := normalizeHouseholdName(req.Name)
	if name == "" {
		fail(c, http.StatusBadRequest, "家庭名称不能为空")
		return
	}

	now := time.Now()
	household := model.Household{
		Name:        name,
		Kind:        householdKindShared,
		OwnerUserID: userID,
		Status:      householdStatusActive,
	}
	member := model.HouseholdMember{
		UserID:   userID,
		Role:     householdRoleOwner,
		Status:   householdMemberStatusActive,
		JoinedAt: &now,
	}

	if err := database.GetDB().Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&household).Error; err != nil {
			return err
		}
		member.HouseholdID = household.ID
		return tx.Create(&member).Error
	}); err != nil {
		fail(c, http.StatusInternalServerError, "创建家庭失败")
		return
	}

	success(c, householdSummary{
		ID:          household.ID,
		Name:        household.Name,
		Kind:        household.Kind,
		Status:      household.Status,
		OwnerUserID: household.OwnerUserID,
		Role:        householdRoleOwner,
		MemberCount: 1,
	})
}

func (h *Handler) ListHouseholdMembers(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	ctx, ok := readHouseholdContext(c, userID)
	if !ok {
		return
	}

	var members []model.HouseholdMember
	if err := database.GetDB().
		Where("household_id = ? AND status = ?", ctx.Household.ID, householdMemberStatusActive).
		Order("CASE role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END").
		Order("joined_at ASC").
		Find(&members).Error; err != nil {
		fail(c, http.StatusInternalServerError, "读取家庭成员失败")
		return
	}

	payload := make([]householdMemberPayload, 0, len(members))
	for _, member := range members {
		payload = append(payload, householdMemberPayload{
			ID:          member.ID,
			HouseholdID: member.HouseholdID,
			UserID:      member.UserID,
			Role:        member.Role,
			Status:      member.Status,
			JoinedAt:    member.JoinedAt,
			LeftAt:      member.LeftAt,
		})
	}

	success(c, gin.H{
		"householdId": ctx.Household.ID,
		"list":        payload,
	})
}

func (h *Handler) CreateHouseholdInvite(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	ctx, ok := readHouseholdContext(c, userID)
	if !ok {
		return
	}
	if ctx.Household.Kind != householdKindShared {
		fail(c, http.StatusBadRequest, "个人空间不支持邀请成员")
		return
	}
	if ctx.Member.Role != householdRoleOwner && ctx.Member.Role != householdRoleAdmin {
		fail(c, http.StatusForbidden, "只有家庭管理员可以邀请成员")
		return
	}

	invite := model.HouseholdInvite{
		HouseholdID:   ctx.Household.ID,
		InviterUserID: userID,
		InviteCode:    generateHouseholdInviteCode(),
		Status:        householdInviteStatusPending,
	}
	expiresAt := time.Now().Add(7 * 24 * time.Hour)
	invite.ExpiresAt = &expiresAt

	if err := database.GetDB().Create(&invite).Error; err != nil {
		fail(c, http.StatusInternalServerError, "创建邀请失败")
		return
	}

	success(c, gin.H{
		"householdId": ctx.Household.ID,
		"inviteCode":  invite.InviteCode,
		"expiresAt":   invite.ExpiresAt,
		"status":      invite.Status,
	})
}

func (h *Handler) JoinHousehold(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	var req joinHouseholdRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, http.StatusBadRequest, "参数错误")
		return
	}

	inviteCode := strings.TrimSpace(req.InviteCode)
	if inviteCode == "" {
		fail(c, http.StatusBadRequest, "邀请码不能为空")
		return
	}

	var joinedHousehold model.Household
	if err := database.GetDB().Transaction(func(tx *gorm.DB) error {
		var invite model.HouseholdInvite
		if err := tx.
			Where("invite_code = ? AND status = ?", inviteCode, householdInviteStatusPending).
			First(&invite).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return errors.New("invite_not_found")
			}
			return err
		}

		now := time.Now()
		if invite.ExpiresAt != nil && invite.ExpiresAt.Before(now) {
			if err := tx.Model(&invite).Update("status", householdInviteStatusExpired).Error; err != nil {
				return err
			}
			return errors.New("invite_expired")
		}

		if err := tx.
			Where("id = ? AND status = ?", invite.HouseholdID, householdStatusActive).
			First(&joinedHousehold).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return errors.New("household_inactive")
			}
			return err
		}

		var activeMember model.HouseholdMember
		if err := tx.
			Where("household_id = ? AND user_id = ? AND status = ?", joinedHousehold.ID, userID, householdMemberStatusActive).
			First(&activeMember).Error; err == nil {
			return errors.New("already_joined")
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}

		var historicalMember model.HouseholdMember
		err := tx.
			Where("household_id = ? AND user_id = ?", joinedHousehold.ID, userID).
			Order("updated_at DESC").
			First(&historicalMember).Error
		if err == nil {
			if err := tx.Model(&historicalMember).Updates(map[string]interface{}{
				"role":      householdRoleMember,
				"status":    householdMemberStatusActive,
				"joined_at": now,
				"left_at":   nil,
			}).Error; err != nil {
				return err
			}
		} else if errors.Is(err, gorm.ErrRecordNotFound) {
			member := model.HouseholdMember{
				HouseholdID: joinedHousehold.ID,
				UserID:      userID,
				Role:        householdRoleMember,
				Status:      householdMemberStatusActive,
				JoinedAt:    &now,
			}
			if err := tx.Create(&member).Error; err != nil {
				return err
			}
		} else {
			return err
		}

		acceptedBy := userID
		return tx.Model(&invite).Updates(map[string]interface{}{
			"status":              householdInviteStatusAccepted,
			"accepted_by_user_id": &acceptedBy,
			"accepted_at":         now,
		}).Error
	}); err != nil {
		switch err.Error() {
		case "invite_not_found":
			fail(c, http.StatusNotFound, "邀请码不存在或已失效")
		case "invite_expired":
			fail(c, http.StatusBadRequest, "邀请码已过期")
		case "household_inactive":
			fail(c, http.StatusBadRequest, "家庭已不可加入")
		case "already_joined":
			fail(c, http.StatusBadRequest, "你已经在这个家庭里了")
		default:
			fail(c, http.StatusInternalServerError, "加入家庭失败")
		}
		return
	}

	memberCount, err := activeHouseholdMemberCount(joinedHousehold.ID)
	if err != nil {
		fail(c, http.StatusInternalServerError, "读取家庭失败")
		return
	}

	success(c, householdSummary{
		ID:          joinedHousehold.ID,
		Name:        joinedHousehold.Name,
		Kind:        joinedHousehold.Kind,
		Status:      joinedHousehold.Status,
		OwnerUserID: joinedHousehold.OwnerUserID,
		Role:        householdRoleMember,
		MemberCount: memberCount,
	})
}

func (h *Handler) LeaveHousehold(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	ctx, ok := readHouseholdContext(c, userID)
	if !ok {
		return
	}
	if ctx.Household.Kind == householdKindPersonal {
		fail(c, http.StatusBadRequest, "个人空间不能退出")
		return
	}

	memberCount, err := activeHouseholdMemberCount(ctx.Household.ID)
	if err != nil {
		fail(c, http.StatusInternalServerError, "读取家庭失败")
		return
	}
	if ctx.Member.Role == householdRoleOwner {
		if memberCount > 1 {
			fail(c, http.StatusBadRequest, "请先转移家庭所有者后再退出")
			return
		}
		fail(c, http.StatusBadRequest, "最后一位成员请先解散家庭")
		return
	}

	now := time.Now()
	if err := database.GetDB().Model(&model.HouseholdMember{}).
		Where("id = ?", ctx.Member.ID).
		Updates(map[string]interface{}{
			"status":  householdMemberStatusLeft,
			"left_at": now,
		}).Error; err != nil {
		fail(c, http.StatusInternalServerError, "退出家庭失败")
		return
	}

	success(c, gin.H{
		"householdId": ctx.Household.ID,
		"left":        true,
	})
}

func (h *Handler) TransferHouseholdOwner(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	ctx, ok := readHouseholdContext(c, userID)
	if !ok {
		return
	}
	if ctx.Household.Kind == householdKindPersonal {
		fail(c, http.StatusBadRequest, "个人空间不支持转移所有者")
		return
	}
	if ctx.Member.Role != householdRoleOwner {
		fail(c, http.StatusForbidden, "只有家庭所有者可以转移权限")
		return
	}

	var req transferHouseholdOwnerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, http.StatusBadRequest, "参数错误")
		return
	}
	if req.TargetUserID == 0 {
		fail(c, http.StatusBadRequest, "目标成员不能为空")
		return
	}
	if req.TargetUserID == userID {
		fail(c, http.StatusBadRequest, "当前已是家庭所有者")
		return
	}

	var targetMember model.HouseholdMember
	if err := database.GetDB().
		Where("household_id = ? AND user_id = ? AND status = ?", ctx.Household.ID, req.TargetUserID, householdMemberStatusActive).
		First(&targetMember).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			fail(c, http.StatusBadRequest, "目标成员不存在或已离开家庭")
			return
		}
		fail(c, http.StatusInternalServerError, "读取目标成员失败")
		return
	}

	if err := database.GetDB().Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&model.Household{}).
			Where("id = ?", ctx.Household.ID).
			Update("owner_user_id", req.TargetUserID).Error; err != nil {
			return err
		}
		if err := tx.Model(&model.HouseholdMember{}).
			Where("id = ?", ctx.Member.ID).
			Update("role", householdRoleAdmin).Error; err != nil {
			return err
		}
		return tx.Model(&model.HouseholdMember{}).
			Where("id = ?", targetMember.ID).
			Update("role", householdRoleOwner).Error
	}); err != nil {
		fail(c, http.StatusInternalServerError, "转移家庭所有者失败")
		return
	}

	memberCount, err := activeHouseholdMemberCount(ctx.Household.ID)
	if err != nil {
		fail(c, http.StatusInternalServerError, "读取家庭失败")
		return
	}

	success(c, householdSummary{
		ID:          ctx.Household.ID,
		Name:        ctx.Household.Name,
		Kind:        ctx.Household.Kind,
		Status:      ctx.Household.Status,
		OwnerUserID: req.TargetUserID,
		Role:        householdRoleAdmin,
		MemberCount: memberCount,
	})
}

func (h *Handler) DissolveHousehold(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		fail(c, http.StatusUnauthorized, "未登录")
		return
	}

	ctx, ok := readHouseholdContext(c, userID)
	if !ok {
		return
	}
	if ctx.Household.Kind == householdKindPersonal {
		fail(c, http.StatusBadRequest, "个人空间不能解散")
		return
	}
	if ctx.Member.Role != householdRoleOwner {
		fail(c, http.StatusForbidden, "只有家庭所有者可以解散家庭")
		return
	}

	now := time.Now()
	if err := database.GetDB().Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&model.Household{}).
			Where("id = ?", ctx.Household.ID).
			Updates(map[string]interface{}{
				"status":       householdStatusDissolved,
				"dissolved_at": now,
			}).Error; err != nil {
			return err
		}

		return tx.Model(&model.HouseholdMember{}).
			Where("household_id = ? AND status = ?", ctx.Household.ID, householdMemberStatusActive).
			Updates(map[string]interface{}{
				"status":  householdMemberStatusRemoved,
				"left_at": now,
			}).Error
	}); err != nil {
		fail(c, http.StatusInternalServerError, "解散家庭失败")
		return
	}

	success(c, gin.H{
		"householdId": ctx.Household.ID,
		"status":      householdStatusDissolved,
	})
}
