package passu

import (
	"fmt"
	"github.com/chzyer/readline"
	"github.com/kballard/go-shellquote"
	"github.com/urfave/cli"
	"github.com/winded/passu-lib"
	"strings"
)

type IReadline interface {
	SetPrompt(prompt string)
	Readline() (string, error)
	ReadPassword(prompt string) ([]byte, error)
}

type PromptSettings struct {
	RL            IReadline
	PromptText    string
	FilePath      string
	PrintFunc     func(text string)
	WriteFileFunc func(data []byte) error
	CopyFunc      func(text string) error
	ExitFunc      func()
}

func createCli(db *passulib.PasswordDatabase, settings *PromptSettings) *cli.App {
	cliApp := cli.NewApp()
	cliApp.Name = "[passu]"
	cliApp.UsageText = "[passu] command (flags) (args...)"
	cliApp.Usage = "Simple password manager"
	cliApp.HideVersion = true
	cliApp.ExitErrHandler = func(c *cli.Context, err error) {}

	cliApp.Commands = commands(db, settings)

	return cliApp
}

func CreatePrompt(db *passulib.PasswordDatabase, settings *PromptSettings) func() error {
	shouldExit := false
	settings.ExitFunc = func() {
		shouldExit = true
	}

	cliApp := createCli(db, settings)

	inputReader, err := readline.New(settings.PromptText)
	if err != nil {
		panic(err)
	}

	return func() error {
		for {
			input, err := inputReader.Readline()
			if err == readline.ErrInterrupt {
				input = "exit"
			} else if err != nil {
				continue
			}

			if strings.TrimSpace(input) == "" {
				continue
			}

			sInput, err := shellquote.Split(input)
			if err != nil {
				settings.PrintFunc(fmt.Sprint("ERROR:", err))
				continue
			}
			sInput = append([]string{"passu"}, sInput...)

			err = cliApp.Run(sInput)
			if err != nil {
				settings.PrintFunc(fmt.Sprint("ERROR:", err))
			}

			if shouldExit {
				break
			}
		}
		inputReader.Close()
		return nil
	}
}

func RunCommand(command []string, db *passulib.PasswordDatabase, settings *PromptSettings) error {
	cliApp := createCli(db, settings)
	cmd := append([]string{"passu"}, command...)
	return cliApp.Run(cmd)
}
