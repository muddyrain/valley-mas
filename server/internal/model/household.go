package model

import (
	"time"
	"valley-server/internal/utils"

	"gorm.io/gorm"
)

type Household struct {
	ID          Int64String    `gorm:"primaryKey;autoIncrement:false" json:"id"`
	Name        string         `gorm:"size:120;not null" json:"name"`
	Kind        string         `gorm:"size:20;not null;default:'shared';index" json:"kind"`
	OwnerUserID Int64String    `gorm:"column:owner_user_id;index;not null" json:"ownerUserId"`
	Status      string         `gorm:"size:20;not null;default:'active';index" json:"status"`
	DissolvedAt *time.Time     `gorm:"column:dissolved_at" json:"dissolvedAt,omitempty"`
	CreatedAt   time.Time      `json:"createdAt"`
	UpdatedAt   time.Time      `json:"updatedAt"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

func (household *Household) BeforeCreate(tx *gorm.DB) error {
	if household.ID == 0 {
		if household.Kind == "personal" && household.OwnerUserID != 0 {
			household.ID = Int64String(-int64(household.OwnerUserID))
		} else {
			household.ID = Int64String(utils.GenerateID())
		}
	}
	if household.Kind == "" {
		household.Kind = "shared"
	}
	if household.Status == "" {
		household.Status = "active"
	}
	return nil
}

type HouseholdMember struct {
	ID          Int64String    `gorm:"primaryKey;autoIncrement:false" json:"id"`
	HouseholdID Int64String    `gorm:"column:household_id;index;not null;uniqueIndex:uidx_household_member_status" json:"householdId"`
	UserID      Int64String    `gorm:"column:user_id;index;not null;uniqueIndex:uidx_household_member_status" json:"userId"`
	Role        string         `gorm:"size:20;not null;default:'member'" json:"role"`
	Status      string         `gorm:"size:20;not null;default:'active';uniqueIndex:uidx_household_member_status" json:"status"`
	JoinedAt    *time.Time     `gorm:"column:joined_at" json:"joinedAt,omitempty"`
	LeftAt      *time.Time     `gorm:"column:left_at" json:"leftAt,omitempty"`
	CreatedAt   time.Time      `json:"createdAt"`
	UpdatedAt   time.Time      `json:"updatedAt"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

func (member *HouseholdMember) BeforeCreate(tx *gorm.DB) error {
	if member.ID == 0 {
		member.ID = Int64String(utils.GenerateID())
	}
	if member.Role == "" {
		member.Role = "member"
	}
	if member.Status == "" {
		member.Status = "active"
	}
	if member.JoinedAt == nil && member.Status == "active" {
		now := time.Now()
		member.JoinedAt = &now
	}
	return nil
}

type HouseholdInvite struct {
	ID               Int64String    `gorm:"primaryKey;autoIncrement:false" json:"id"`
	HouseholdID      Int64String    `gorm:"column:household_id;index;not null" json:"householdId"`
	InviterUserID    Int64String    `gorm:"column:inviter_user_id;index;not null" json:"inviterUserId"`
	InviteCode       string         `gorm:"size:64;not null;uniqueIndex" json:"inviteCode"`
	Status           string         `gorm:"size:20;not null;default:'pending';index" json:"status"`
	ExpiresAt        *time.Time     `gorm:"column:expires_at" json:"expiresAt,omitempty"`
	AcceptedByUserID *Int64String   `gorm:"column:accepted_by_user_id;index" json:"acceptedByUserId,omitempty"`
	AcceptedAt       *time.Time     `gorm:"column:accepted_at" json:"acceptedAt,omitempty"`
	CreatedAt        time.Time      `json:"createdAt"`
	UpdatedAt        time.Time      `json:"updatedAt"`
	DeletedAt        gorm.DeletedAt `gorm:"index" json:"-"`
}

func (invite *HouseholdInvite) BeforeCreate(tx *gorm.DB) error {
	if invite.ID == 0 {
		invite.ID = Int64String(utils.GenerateID())
	}
	if invite.Status == "" {
		invite.Status = "pending"
	}
	return nil
}
