package skill

import (
	"database/sql"
	"stepbit-app/internal/skill/handlers"
	"stepbit-app/internal/skill/services"
	"github.com/gofiber/fiber/v2"
)

type SkillModule struct {
	SkillHandler *handlers.SkillHandler
	SkillService *services.SkillService
}

func NewSkillModule(db *sql.DB) *SkillModule {
	skillService := services.NewSkillService(db)
	skillHandler := handlers.NewSkillHandler(skillService)

	return &SkillModule{
		SkillHandler: skillHandler,
		SkillService: skillService,
	}
}

func (m *SkillModule) RegisterRoutes(app *fiber.App) {
	api := app.Group("/api/skills")

	api.Get("/", m.SkillHandler.ListSkills)
	api.Post("/", m.SkillHandler.CreateSkill)
	api.Get("/:id", m.SkillHandler.GetSkill)
	api.Patch("/:id", m.SkillHandler.UpdateSkill)
	api.Delete("/:id", m.SkillHandler.DeleteSkill)
}
