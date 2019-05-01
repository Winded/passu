package main

import (
	"errors"
	"fmt"
	"github.com/atotto/clipboard"
	"github.com/chzyer/readline"
	"github.com/urfave/cli"
	"github.com/winded/passu-lib"
	"github.com/winded/passu/passu"
	"os"
	"path"
	"strings"
)

func loadOrCreateDb(pwFile string, settings *passu.PromptSettings) (*passulib.PasswordDatabase, error) {
	if stat, err := os.Stat(pwFile); !os.IsNotExist(err) {
		fmt.Println("Opening password file.")

		f, err := os.Open(pwFile)
		if err != nil {
			return nil, err
		}
		defer f.Close()

		bytes := make([]byte, stat.Size())
		_, err = f.Read(bytes)
		if err != nil {
			return nil, err
		}

		pwInput, err := settings.RL.ReadPassword("Master password: ")
		if err != nil {
			return nil, err
		}

		db, err := passulib.PasswordDatabaseFromData(bytes, string(pwInput))
		if err != nil {
			return nil, err
		}

		return db, nil
	} else {
		fmt.Println("File does not exist. Creating new password database.")

		pwBytes, err := settings.RL.ReadPassword("Master password: ")
		if err != nil {
			return nil, err
		}
		pwBytesConfirm, err := settings.RL.ReadPassword("Confirm password: ")
		if err != nil {
			return nil, err
		}
		pwInput := string(pwBytes)
		pwInputConfirm := string(pwBytesConfirm)

		if strings.TrimSpace(pwInput) == "" {
			return nil, errors.New("Password cannot be empty.")
		}
		if pwInput != pwInputConfirm {
			return nil, errors.New("Passwords do not match.")
		}

		db := passulib.NewPasswordDatabase(pwInput)
		data := db.Save()
		err = settings.WriteFileFunc(data)
		if err != nil {
			return nil, err
		}

		return db, nil
	}
}

func main() {
	app := cli.NewApp()

	app.Name = "passu"
	app.Usage = "Simple password manager"
	app.HideVersion = true
	app.ArgsUsage = "<password-file> [command...]"

	app.Action = func(c *cli.Context) error {
		if c.NArg() < 1 {
			return errors.New("Missing password file argument. Use -h option for help.")
		}

		pwFile := c.Args().Get(0)

		settings := passu.PromptSettings{}
		settings.FilePath = pwFile
		settings.PromptText = fmt.Sprintf("%v> ", path.Base(settings.FilePath))
		settings.RL, _ = readline.New(settings.PromptText)

		settings.PrintFunc = func(text string) {
			fmt.Println(text)
		}
		settings.WriteFileFunc = func(data []byte) error {
			f, err := os.Create(settings.FilePath)
			if err != nil {
				return err
			}
			defer f.Close()

			_, err = f.Write(data)
			if err != nil {
				return err
			}

			return nil
		}
		settings.CopyFunc = func(text string) error {
			return clipboard.WriteAll(text)
		}

		db, err := loadOrCreateDb(pwFile, &settings)
		if err != nil {
			return err
		}

		if c.NArg() > 1 {
			args := c.Args().Tail()
			return passu.RunCommand(args, db, &settings)
		}

		prompt := passu.CreatePrompt(db, &settings)
		err = prompt()

		return err
	}

	err := app.Run(os.Args)
	if err != nil {
		fmt.Println("ERROR:", err)
	}
}
