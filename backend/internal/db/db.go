package db

import (
	"encoding/json"
	"log"
	"os"
	"path/filepath"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"survey/backend/internal/models"
)

func Connect(databaseURL string) *gorm.DB {
	// PreferSimpleProtocol: required behind PgBouncer in transaction pool_mode,
	// where server-side prepared statements break across pooled connections.
	db, err := gorm.Open(postgres.New(postgres.Config{
		DSN:                  databaseURL,
		PreferSimpleProtocol: true,
	}), &gorm.Config{})
	if err != nil {
		log.Fatalf("db connect: %v", err)
	}
	if err := db.AutoMigrate(&models.User{}, &models.Survey{}, &models.Response{}, &models.Setting{}); err != nil {
		log.Fatalf("db migrate: %v", err)
	}
	return db
}

var defaultSettings = map[string]string{
	"app_name":      "Họ Ngô Việt Nam",
	"primary_color": "#8B0000",
	"font_family":   "Be Vietnam Pro",
	"logo_url":      "https://aidx-vn.github.io/ngogia-legal/logo.svg",
}

func Seed(db *gorm.DB, seedDir string) {
	for k, v := range defaultSettings {
		setting := models.Setting{Key: k, Value: v}
		db.Where(models.Setting{Key: k}).FirstOrCreate(&setting)
	}

	var count int64
	db.Model(&models.Survey{}).Count(&count)
	if count > 0 {
		return
	}

	files, err := filepath.Glob(filepath.Join(seedDir, "*.json"))
	if err != nil || len(files) == 0 {
		return
	}
	for _, f := range files {
		data, err := os.ReadFile(f)
		if err != nil {
			log.Printf("seed: read %s: %v", f, err)
			continue
		}
		var doc struct {
			Title       string          `json:"title"`
			Description string          `json:"description"`
			Status      string          `json:"status"`
			Schema      json.RawMessage `json:"schema"`
		}
		if err := json.Unmarshal(data, &doc); err != nil {
			log.Printf("seed: parse %s: %v", f, err)
			continue
		}
		if doc.Status == "" {
			doc.Status = "active"
		}
		db.Create(&models.Survey{
			Title:       doc.Title,
			Description: doc.Description,
			Status:      doc.Status,
			Schema:      []byte(doc.Schema),
		})
		log.Printf("seed: created survey %q from %s", doc.Title, filepath.Base(f))
	}
}
