package models

type AppConfig struct {
	Database struct {
		Path string `yaml:"path"`
	} `yaml:"database"`

	Server struct {
		Port string `yaml:"port"`
		Key  string `yaml:"key"`
	} `yaml:"server"`

	Providers struct {
		Ollama struct {
			URL string `yaml:"url"`
		} `yaml:"ollama"`
		StepbitCore struct {
			URL string `yaml:"url"`
		} `yaml:"stepbit_core"`
	} `yaml:"providers"`

	Skills struct {
		Dir string `yaml:"dir"`
	} `yaml:"skills"`
}
