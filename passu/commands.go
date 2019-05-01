package passu

import (
	"errors"
	"fmt"
	"github.com/guregu/null"
	"github.com/urfave/cli"
	"github.com/winded/passu-lib"
	"io"
	"sort"
	"strconv"
	"strings"
)

func promptInt(prompt string, settings *PromptSettings) null.Int {
	settings.RL.SetPrompt(prompt)
	defer settings.RL.SetPrompt(settings.PromptText)

	inp, _ := settings.RL.Readline()
	if inp != "" {
		val, err := strconv.Atoi(inp)
		if err == nil {
			return null.IntFrom(int64(val))
		}

		fmt.Println("Could not parse value. Using default")
	}

	return null.NewInt(0, false)
}
func promptBool(prompt string, settings *PromptSettings) null.Bool {
	settings.RL.SetPrompt(prompt)
	defer settings.RL.SetPrompt(settings.PromptText)

	inp, _ := settings.RL.Readline()
	if strings.ToLower(inp) == "y" {
		return null.BoolFrom(true)
	} else if strings.ToLower(inp) == "n" {
		return null.BoolFrom(false)
	} else {
		return null.NewBool(false, false)
	}
}

func commands(db *passulib.PasswordDatabase, settings *PromptSettings) []cli.Command {
	return []cli.Command{
		{
			Name:    "change-master-password",
			Usage:   "Change database password",
			Aliases: []string{"cmp"},
			Action: func(c *cli.Context) error {
				newPassword, _ := settings.RL.ReadPassword("New master password: ")
				confirmPassword, _ := settings.RL.ReadPassword("Confirm new password: ")

				if strings.TrimSpace(string(newPassword)) == "" {
					return errors.New("Empty password")
				} else if string(newPassword) != string(confirmPassword) {
					return errors.New("Passwords do not match")
				}

				db.SetPassword(string(newPassword))
				settings.PrintFunc("Master password changed. Please save the database to use the new password.")
				return nil
			},
		},
		{
			Name:    "default-policy",
			Aliases: []string{"dp"},
			Subcommands: []cli.Command{
				{
					Name:    "view",
					Usage:   "View default policy",
					Aliases: []string{"v"},
					Action: func(c *cli.Context) error {
						policy := db.GetDefaultPolicy()

						length := policy.Length.ValueOrZero()

						useStrings := make([]string, 0, 4)
						if policy.UseLowercase.Bool {
							useStrings = append(useStrings, "lowercase")
						}
						if policy.UseUppercase.Bool {
							useStrings = append(useStrings, "uppercase")
						}
						if policy.UseNumbers.Bool {
							useStrings = append(useStrings, "numbers")
						}
						if policy.UseSpecial.Bool {
							useStrings = append(useStrings, "special characters")
						}

						useString := strings.Join(useStrings, ", ")

						settings.PrintFunc(fmt.Sprint("Length: ", length))
						settings.PrintFunc(fmt.Sprint("Characters: ", useString))

						return nil
					},
				},
				{
					Name:    "change",
					Usage:   "Change default policy",
					Aliases: []string{"c"},
					Action: func(c *cli.Context) error {
						policy := db.GetDefaultPolicy()

						settings.PrintFunc("Enter new policy values (leave blank to not change)")

						policy.Length = promptInt("Length: ", settings)
						policy.UseLowercase = promptBool("Use Lowercase [y/n]: ", settings)
						policy.UseUppercase = promptBool("Use Uppercase [y/n]: ", settings)
						policy.UseNumbers = promptBool("Use Numbers [y/n]: ", settings)
						policy.UseSpecial = promptBool("Use Special characters [y/n]: ", settings)

						err := db.SetDefaultPolicy(policy)
						return err
					},
				},
			},
		},
		{
			Name:        "passwords",
			Aliases:     []string{"pw"},
			Subcommands: passwordCommands(db, settings),
		},
		{
			Name:  "save",
			Usage: "Save the password database to file",
			Action: func(c *cli.Context) error {
				bytes := db.Save()
				err := settings.WriteFileFunc(bytes)
				if err != nil {
					return err
				}

				fmt.Println("Password database saved to ", settings.FilePath)
				return nil
			},
		},
		{
			Name:    "exit",
			Usage:   "Exit prompt",
			Aliases: []string{"quit"},
			Flags: []cli.Flag{
				cli.BoolFlag{
					Name:  "force, f",
					Usage: "Force exit without saving",
				},
			},
			Action: func(c *cli.Context) error {
				if db.Modified && !c.Bool("force") {
					fmt.Println("Unsaved changes detected. Please save your password database using \"save\", or exit without saving using the \"-f\" option")
				} else {
					settings.ExitFunc()
				}
				return nil
			},
		},
	}
}

func passwordCommands(db *passulib.PasswordDatabase, settings *PromptSettings) []cli.Command {
	return []cli.Command{{
		Name:    "list",
		Usage:   "List password entries",
		Aliases: []string{"l"},
		Action: func(c *cli.Context) error {
			entries := db.AllEntries()
			if len(entries) == 0 {
				settings.PrintFunc("No entries found")
				return nil
			}

			entryNames := make([]string, len(entries))
			for idx, entry := range entries {
				entryNames[idx] = entry.Name
			}

			sort.Strings(entryNames)
			for _, name := range entryNames {
				settings.PrintFunc(name)
			}

			return nil
		},
	},
		{
			Name:      "new",
			Usage:     "Create new password entry",
			ArgsUsage: "<name> [description]",
			Aliases:   []string{"n"},
			Action: func(c *cli.Context) error {
				if c.NArg() < 1 {
					return errors.New("Missing name argument")
				}

				name := c.Args().Get(0)
				description := ""
				if c.NArg() >= 2 {
					description = c.Args().Get(1)
				}

				pwBytes, err := settings.RL.ReadPassword("Password (leave empty to generate): ")
				if err != nil && err != io.EOF {
					return err
				}
				pw := string(pwBytes)

				err = db.AddEntry(passulib.PasswordEntry{
					Name:           name,
					Password:       pw,
					Description:    description,
					PolicyOverride: passulib.PasswordPolicy{},
				})
				if err != nil {
					return err
				}

				if pw == "" {
					_, err = db.GeneratePassword(name)
					if err != nil {
						return err
					}
				}

				settings.PrintFunc("Password added")
				return nil
			},
		},
		{
			Name:      "show",
			Usage:     "Show password entry",
			ArgsUsage: "<name>",
			Aliases:   []string{"s"},
			Flags: []cli.Flag{
				cli.BoolFlag{
					Name:  "pass-only, p",
					Usage: "Only show password",
				},
			},
			Action: func(c *cli.Context) error {
				if c.NArg() < 1 {
					return errors.New("Missing name argument")
				}

				entry, idx := db.GetEntry(c.Args().Get(0))
				if idx == -1 {
					return errors.New("Entry not found")
				}

				if c.Bool("pass-only") {
					settings.PrintFunc(entry.Password)
					return nil
				}

				settings.PrintFunc(fmt.Sprintf("Name: %v", entry.Name))
				settings.PrintFunc(fmt.Sprintf("Password: (%v characters)", len(entry.Password)))
				if entry.Description != "" {
					settings.PrintFunc(fmt.Sprintf("Description: \n %v", entry.Description))
				} else {
					settings.PrintFunc("No description")
				}

				return nil
			},
		},
		{
			Name:      "copy",
			Usage:     "Copy password to clipboard",
			ArgsUsage: "<name>",
			Aliases:   []string{"cp"},
			Action: func(c *cli.Context) error {
				if c.NArg() < 1 {
					return errors.New("Missing name argument")
				}

				entry, idx := db.GetEntry(c.Args().Get(0))
				if idx == -1 {
					return errors.New("Entry not found")
				}

				err := settings.CopyFunc(entry.Password)
				if err != nil {
					return err
				}

				settings.PrintFunc("Password copied to clipboard")
				return nil
			},
		},
		{
			Name:      "edit",
			Usage:     "Edit a password entry",
			ArgsUsage: "<name>",
			Aliases:   []string{"e"},
			Flags: []cli.Flag{
				cli.StringFlag{
					Name:  "new-name, n",
					Usage: "Change name of entry",
				},
				cli.StringFlag{
					Name:  "description, d",
					Usage: "Change description of entry",
				},
				cli.BoolFlag{
					Name:  "change-password, p",
					Usage: "Change password",
				},
			},
			Action: func(c *cli.Context) error {
				if c.NArg() < 1 {
					return errors.New("Missing name argument")
				}

				entry, idx := db.GetEntry(c.Args().Get(0))
				if idx == -1 {
					return errors.New("Entry not found")
				}

				if c.IsSet("new-name") {
					entry.Name = c.String("new-name")
				}
				if c.IsSet("description") {
					entry.Description = c.String("description")
				}

				if c.Bool("change-password") {
					newPassword, err := settings.RL.ReadPassword("Password (leave empty to generate): ")
					if err != nil {
						return err
					}
					entry.Password = string(newPassword)
				}

				err := db.UpdateEntry(c.Args().Get(0), entry)
				if err != nil {
					return err
				}

				if c.Bool("change-password") && entry.Password == "" {
					_, err = db.GeneratePassword(entry.Name)
					if err != nil {
						return err
					}
				}

				settings.PrintFunc("Entry updated")
				return nil
			},
		},
		{
			Name:      "delete",
			Usage:     "Delete a password entry",
			ArgsUsage: "<name>",
			Aliases:   []string{"d"},
			Action: func(c *cli.Context) error {
				if c.NArg() < 1 {
					return errors.New("Missing name argument")
				}

				_, err := db.RemoveEntry(c.Args().Get(0))
				if err != nil {
					return err
				}

				settings.PrintFunc("Entry removed")
				return nil
			},
		},
		{
			Name:    "policy",
			Aliases: []string{"p"},
			Subcommands: []cli.Command{
				{
					Name:      "view",
					Usage:     "Show password policy of entry",
					ArgsUsage: "<name>",
					Aliases:   []string{"v"},
					Action: func(c *cli.Context) error {
						if c.NArg() < 1 {
							return errors.New("Missing name argument")
						}

						entry, idx := db.GetEntry(c.Args().Get(0))
						if idx == -1 {
							return errors.New("Entry not found")
						}

						policy := entry.PolicyOverride
						defaultPolicy := db.GetDefaultPolicy()

						sLength := fmt.Sprintf("%v (default)", defaultPolicy.Length.ValueOrZero())
						if policy.Length.Valid {
							sLength = fmt.Sprintf("%v", policy.Length.ValueOrZero())
						}

						appendUseString := func(strings []string, value, defaultValue null.Bool, text string) []string {
							if value.Valid && value.Bool {
								return append(strings, text)
							} else if !value.Valid && defaultValue.Bool {
								return append(strings, fmt.Sprintf("%v (default)", text))
							}

							return strings
						}

						useStrings := make([]string, 0, 4)
						useStrings = appendUseString(useStrings, policy.UseLowercase, defaultPolicy.UseLowercase, "lowercase")
						useStrings = appendUseString(useStrings, policy.UseUppercase, defaultPolicy.UseUppercase, "uppercase")
						useStrings = appendUseString(useStrings, policy.UseNumbers, defaultPolicy.UseNumbers, "numbers")
						useStrings = appendUseString(useStrings, policy.UseSpecial, defaultPolicy.UseSpecial, "special characters")

						useString := strings.Join(useStrings, ", ")

						settings.PrintFunc(fmt.Sprint("Length: ", sLength))
						settings.PrintFunc(fmt.Sprint("Characters: ", useString))

						return nil
					},
				},
				{
					Name:      "change",
					Usage:     "Change password policy of entry",
					ArgsUsage: "<name>",
					Aliases:   []string{"c"},
					Action: func(c *cli.Context) error {
						if c.NArg() < 1 {
							return errors.New("Missing name argument")
						}

						entry, idx := db.GetEntry(c.Args().Get(0))
						if idx == -1 {
							return errors.New("Entry not found")
						}

						policy := entry.PolicyOverride

						settings.PrintFunc("Enter new policy values (leave blank to use default)")

						policy.Length = promptInt("Length: ", settings)
						policy.UseLowercase = promptBool("Use Lowercase [y/n]: ", settings)
						policy.UseUppercase = promptBool("Use Uppercase [y/n]: ", settings)
						policy.UseNumbers = promptBool("Use Numbers [y/n]: ", settings)
						policy.UseSpecial = promptBool("Use Special characters [y/n]: ", settings)

						entry.PolicyOverride = policy
						err := db.UpdateEntry(entry.Name, entry)
						if err != nil {
							return err
						}

						settings.PrintFunc("Entry policy updated")
						return nil
					},
				},
			},
		},
	}
}
