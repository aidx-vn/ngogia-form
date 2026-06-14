package models

import (
	"time"

	"gorm.io/datatypes"
)

type User struct {
	ID         uint           `gorm:"primaryKey" json:"id"`
	Provider   string         `gorm:"size:32;uniqueIndex:idx_provider_uid" json:"provider"`
	ProviderID string         `gorm:"size:128;uniqueIndex:idx_provider_uid" json:"-"`
	Email      string         `gorm:"size:255;index" json:"email"`
	Name       string         `gorm:"size:255" json:"name"`
	AvatarURL  string         `gorm:"size:512" json:"avatar_url"`
	Role       string         `gorm:"size:16;default:user" json:"role"`
	Profile    datatypes.JSON `gorm:"default:null" json:"profile,omitempty"`
	CreatedAt  time.Time      `json:"created_at"`
}

type Survey struct {
	ID          uint           `gorm:"primaryKey" json:"id"`
	Title       string         `gorm:"size:255" json:"title"`
	Description string         `json:"description"`
	Status      string         `gorm:"size:16;default:draft;index" json:"status"` // draft | active | closed
	Schema      datatypes.JSON `json:"schema"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
}

type Response struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	SurveyID  uint           `gorm:"uniqueIndex:idx_survey_user;index" json:"survey_id"`
	UserID    uint           `gorm:"uniqueIndex:idx_survey_user" json:"user_id"`
	User      *User          `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Answers   datatypes.JSON `json:"answers"`
	CreatedAt time.Time      `json:"created_at"`
}

type Setting struct {
	Key   string `gorm:"primaryKey;size:64" json:"key"`
	Value string `json:"value"`
}

// Question is the parsed form of one entry in Survey.Schema's "questions" array.
type Question struct {
	ID       string   `json:"id"`
	Type     string   `json:"type"` // single_choice | multiple_choice | text | textarea | rating | scale | number | date
	Label    string   `json:"label"`
	Help     string   `json:"help,omitempty"`
	Required bool     `json:"required"`
	Options  []Option `json:"options,omitempty"`
	Min      *float64 `json:"min,omitempty"`
	Max      *float64 `json:"max,omitempty"`
}

type Option struct {
	Value string `json:"value"`
	Label string `json:"label"`
}

type SurveySchema struct {
	Questions []Question `json:"questions"`
}
