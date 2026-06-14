package main

import (
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"os"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"survey/backend/internal/models"
)

const numUsers = 50

func main() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = "postgres://pgadmin:trust@localhost:5433/survey?sslmode=disable"
	}

	db, err := gorm.Open(postgres.New(postgres.Config{
		DSN:                  dsn,
		PreferSimpleProtocol: true,
	}), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		log.Fatal("connect:", err)
	}

	var surveys []models.Survey
	if err := db.Where("status = ?", "active").Find(&surveys).Error; err != nil {
		log.Fatal("load surveys:", err)
	}
	if len(surveys) == 0 {
		log.Fatal("no active surveys found")
	}
	fmt.Printf("Found %d active survey(s)\n", len(surveys))

	rng := rand.New(rand.NewSource(time.Now().UnixNano()))
	created, skipped := 0, 0

	for i := 1; i <= numUsers; i++ {
		user := models.User{
			Provider:   "test",
			ProviderID: fmt.Sprintf("test-%d", i),
			Email:      fmt.Sprintf("test%d@seed.local", i),
			Name:       fmt.Sprintf("Người dùng thử %d", i),
			Role:       "user",
		}
		if err := db.Where("provider = ? AND provider_id = ?", user.Provider, user.ProviderID).
			FirstOrCreate(&user).Error; err != nil {
			log.Printf("upsert user %d: %v", i, err)
			continue
		}

		for _, survey := range surveys {
			var count int64
			db.Model(&models.Response{}).
				Where("survey_id = ? AND user_id = ?", survey.ID, user.ID).
				Count(&count)
			if count > 0 {
				skipped++
				continue
			}

			var schema models.SurveySchema
			if err := json.Unmarshal(survey.Schema, &schema); err != nil {
				log.Printf("parse schema survey %d: %v", survey.ID, err)
				continue
			}

			answers := generateAnswers(rng, schema.Questions)
			answersJSON, _ := json.Marshal(answers)

			resp := models.Response{SurveyID: survey.ID, UserID: user.ID, Answers: answersJSON}
			if err := db.Create(&resp).Error; err != nil {
				log.Printf("create response user=%d survey=%d: %v", i, survey.ID, err)
				continue
			}
			created++
		}
	}

	fmt.Printf("Done: %d responses created, %d skipped (already existed)\n", created, skipped)
}

var sampleTexts = []string{
	"Gia đình tôi cần hỗ trợ về nhà ở và sinh kế.",
	"Tôi muốn tham gia các khóa đào tạo kỹ năng.",
	"Cần hỗ trợ vốn để khởi nghiệp nhỏ.",
	"Gia đình đang gặp khó khăn về chỗ ở.",
	"Muốn cải thiện thu nhập bền vững cho gia đình.",
	"Hiện tại chưa có công việc ổn định, cần hướng dẫn.",
	"Mong muốn được tư vấn về các chương trình hỗ trợ.",
}

var sampleDates = []string{
	"2026-07-01", "2026-08-15", "2026-09-01", "2026-10-20", "2026-12-01", "2027-01-15",
}

func generateAnswers(rng *rand.Rand, questions []models.Question) map[string]any {
	answers := map[string]any{}
	for _, q := range questions {
		if !q.Required && rng.Float64() < 0.25 {
			continue
		}
		switch q.Type {
		case "single_choice":
			if len(q.Options) > 0 {
				answers[q.ID] = q.Options[rng.Intn(len(q.Options))].Value
			}
		case "multiple_choice":
			if len(q.Options) > 0 {
				opts := make([]models.Option, len(q.Options))
				copy(opts, q.Options)
				rng.Shuffle(len(opts), func(i, j int) { opts[i], opts[j] = opts[j], opts[i] })
				n := 1 + rng.Intn(min(3, len(opts)))
				sel := make([]string, n)
				for i := range sel {
					sel[i] = opts[i].Value
				}
				answers[q.ID] = sel
			}
		case "text":
			answers[q.ID] = sampleTexts[rng.Intn(len(sampleTexts))]
		case "textarea":
			answers[q.ID] = sampleTexts[rng.Intn(len(sampleTexts))] + " " + sampleTexts[rng.Intn(len(sampleTexts))]
		case "rating", "scale":
			lo, hi := 1.0, 5.0
			if q.Min != nil {
				lo = *q.Min
			}
			if q.Max != nil {
				hi = *q.Max
			}
			answers[q.ID] = lo + float64(rng.Intn(int(hi-lo)+1))
		case "number":
			lo, hi := 1.0, 10.0
			if q.Min != nil {
				lo = *q.Min
			}
			if q.Max != nil {
				hi = *q.Max
			}
			answers[q.ID] = lo + float64(rng.Intn(int(hi-lo)+1))
		case "date":
			answers[q.ID] = sampleDates[rng.Intn(len(sampleDates))]
		}
	}
	return answers
}
