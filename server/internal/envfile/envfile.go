package envfile

import (
	"bytes"
	"os"

	"github.com/joho/godotenv"
)

var candidates = []string{".env", "server/.env", "./server/.env", "../server/.env"}

// Load applies the first environment file found using the same lookup order for
// every server command. An empty path means no file exists.
func Load() (string, error) {
	for _, path := range candidates {
		if _, err := os.Stat(path); err != nil {
			if os.IsNotExist(err) {
				continue
			}
			return "", err
		}
		if err := loadFile(path); err != nil {
			return "", err
		}
		return path, nil
	}
	return "", nil
}

func loadFile(path string) error {
	content, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	content = bytes.TrimPrefix(content, []byte{0xEF, 0xBB, 0xBF})

	values, err := godotenv.Unmarshal(string(content))
	if err != nil {
		return err
	}
	for key, value := range values {
		if err := os.Setenv(key, value); err != nil {
			return err
		}
	}
	return nil
}
