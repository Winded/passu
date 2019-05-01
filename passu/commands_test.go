package passu_test

import (
	"fmt"
	"github.com/guregu/null"
	. "github.com/onsi/ginkgo"
	. "github.com/onsi/gomega"
	"github.com/winded/passu-lib"
	"github.com/winded/passu/passu"
	"strings"
)

var _ = Describe("CLI commands", func() {
	Context("Change master password", func() {
		It("should change master password of database", func() {
			db := passulib.NewPasswordDatabase("testpassword")
			db.AddEntry(passulib.PasswordEntry{
				Name:        "test",
				Password:    "test",
				Description: "test",
			})

			output := ""
			settings := passu.PromptSettings{
				RL: &ReadlineMock{
					"test> ",
					func(p string) string {
						return "anotherpassword"
					},
				},
				PromptText: "test> ",
				PrintFunc: func(text string) {
					output += text + "\n"
				},
			}
			err := passu.RunCommand([]string{"change-master-password"}, db, &settings)

			Expect(err).To(BeNil())
			Expect(strings.TrimSpace(output)).To(Equal("Master password changed. Please save the database to use the new password."))

			bytes := db.Save()
			_, err = passulib.PasswordDatabaseFromData(bytes, "anotherpassword")

			Expect(err).To(BeNil())
		})
	})

	Context("Default Policy", func() {
		It("should view default policy", func() {
			pwInput := "testpassword"

			db := passulib.NewPasswordDatabase(pwInput)
			db.SetDefaultPolicy(passulib.PasswordPolicy{
				Length:       null.IntFrom(16),
				UseLowercase: null.BoolFrom(false),
				UseUppercase: null.BoolFrom(true),
				UseNumbers:   null.BoolFrom(true),
				UseSpecial:   null.BoolFrom(true),
			})

			output := ""
			settings := passu.PromptSettings{
				RL: &ReadlineMock{
					"test> ",
					func(p string) string {
						return ""
					},
				},
				PromptText: "test> ",
				PrintFunc: func(text string) {
					output += text + "\n"
				},
			}
			err := passu.RunCommand([]string{"default-policy", "view"}, db, &settings)

			Expect(err).To(BeNil())
			Expect(strings.TrimSpace(output)).To(Equal("Length: 16\nCharacters: uppercase, numbers, special characters"))
		})
		It("should change default policy", func() {
			pwInput := "testpassword"

			db := passulib.NewPasswordDatabase(pwInput)
			db.SetDefaultPolicy(passulib.PasswordPolicy{
				Length:       null.IntFrom(16),
				UseLowercase: null.BoolFrom(false),
				UseUppercase: null.BoolFrom(true),
				UseNumbers:   null.BoolFrom(true),
				UseSpecial:   null.BoolFrom(true),
			})

			output := ""
			settings := passu.PromptSettings{
				RL: &ReadlineMock{
					"test> ",
					func(p string) string {
						switch p {
						case "Length: ":
							return "24"
						case "Use Lowercase [y/n]: ":
							return "y"
						case "Use Uppercase [y/n]: ":
							return "n"
						case "Use Numbers [y/n]: ":
							return "y"
						case "Use Special characters [y/n]: ":
							return "n"
						default:
							return ""
						}
					},
				},
				PromptText: "test> ",
				PrintFunc: func(text string) {
					output += text + "\n"
				},
			}
			err := passu.RunCommand([]string{"default-policy", "change"}, db, &settings)

			Expect(err).To(BeNil())
			Expect(db.GetDefaultPolicy()).To(Equal(passulib.PasswordPolicy{
				Length:       null.IntFrom(24),
				UseLowercase: null.BoolFrom(true),
				UseUppercase: null.BoolFrom(false),
				UseNumbers:   null.BoolFrom(true),
				UseSpecial:   null.BoolFrom(false),
			}))
		})
	})

	Context("Default Policy", func() {
		It("should list passwords", func() {
			pwInput := "testpassword"

			db := passulib.NewPasswordDatabase(pwInput)

			output := ""
			settings := passu.PromptSettings{
				RL: &ReadlineMock{
					"test> ",
					func(p string) string {
						return ""
					},
				},
				PromptText: "test> ",
				PrintFunc: func(text string) {
					output += text + "\n"
				},
			}

			db.AddEntry(passulib.PasswordEntry{
				Name:        "test",
				Password:    "mypassword",
				Description: "description",
			})

			err := passu.RunCommand([]string{"passwords", "list"}, db, &settings)

			Expect(err).To(BeNil())
			Expect(strings.TrimSpace(output)).To(Equal("test"))
		})
		It("should show password entry details", func() {
			pwInput := "testpassword"

			db := passulib.NewPasswordDatabase(pwInput)

			output := ""
			settings := passu.PromptSettings{
				RL: &ReadlineMock{
					"test> ",
					func(p string) string {
						return ""
					},
				},
				PromptText: "test> ",
				PrintFunc: func(text string) {
					output += text + "\n"
				},
			}

			entry := passulib.PasswordEntry{
				Name:        "test",
				Password:    "mypassword",
				Description: "description",
			}
			db.AddEntry(entry)

			err := passu.RunCommand([]string{"passwords", "show", "test"}, db, &settings)

			Expect(err).To(BeNil())
			Expect(strings.TrimSpace(output)).To(Equal(fmt.Sprintf("Name: %v\nPassword: (%v characters)\nDescription: \n %v", entry.Name, len(entry.Password), entry.Description)))
		})
		It("should show password", func() {
			pwInput := "testpassword"

			db := passulib.NewPasswordDatabase(pwInput)

			output := ""
			settings := passu.PromptSettings{
				RL: &ReadlineMock{
					"test> ",
					func(p string) string {
						return ""
					},
				},
				PromptText: "test> ",
				PrintFunc: func(text string) {
					output += text + "\n"
				},
			}

			entry := passulib.PasswordEntry{
				Name:        "test",
				Password:    "mypassword",
				Description: "description",
			}
			db.AddEntry(entry)

			err := passu.RunCommand([]string{"passwords", "show", "test", "--pass-only"}, db, &settings)

			Expect(err).To(BeNil())
			Expect(strings.TrimSpace(output)).To(Equal(entry.Password))
		})
		It("should copy password to clipboard", func() {
			pwInput := "testpassword"

			db := passulib.NewPasswordDatabase(pwInput)

			copyData := ""
			output := ""
			settings := passu.PromptSettings{
				RL: &ReadlineMock{
					"test> ",
					func(p string) string {
						return ""
					},
				},
				PromptText: "test> ",
				PrintFunc: func(text string) {
					output += text + "\n"
				},
				CopyFunc: func(text string) error {
					copyData = text
					return nil
				},
			}

			entry := passulib.PasswordEntry{
				Name:        "test",
				Password:    "mypassword",
				Description: "description",
			}
			db.AddEntry(entry)

			err := passu.RunCommand([]string{"passwords", "copy", "test"}, db, &settings)

			Expect(err).To(BeNil())
			Expect(copyData).To(Equal(entry.Password))
		})
	})

	Context("Create/Edit/Delete", func() {
		It("should create new password entry", func() {
			pwInput := "testpassword"

			db := passulib.NewPasswordDatabase(pwInput)

			output := ""
			settings := passu.PromptSettings{
				RL: &ReadlineMock{
					"test> ",
					func(p string) string {
						return "mypassword"
					},
				},
				PromptText: "test> ",
				PrintFunc: func(text string) {
					output += text + "\n"
				},
			}

			err := passu.RunCommand([]string{"passwords", "new", "test", "description"}, db, &settings)

			Expect(err).To(BeNil())

			entry, idx := db.GetEntry("test")

			Expect(idx).NotTo(Equal(-1))
			Expect(entry.Name).To(Equal("test"))
			Expect(entry.Password).To(Equal("mypassword"))
			Expect(entry.Description).To(Equal("description"))
		})
		It("should edit password entry", func() {
			pwInput := "testpassword"

			db := passulib.NewPasswordDatabase(pwInput)

			output := ""
			settings := passu.PromptSettings{
				RL: &ReadlineMock{
					"test> ",
					func(p string) string {
						return "mypassword"
					},
				},
				PromptText: "test> ",
				PrintFunc: func(text string) {
					output += text + "\n"
				},
			}

			err := db.AddEntry(passulib.PasswordEntry{
				Name:        "test",
				Password:    "mypassword",
				Description: "description",
			})

			Expect(err).To(BeNil())

			err = passu.RunCommand([]string{"passwords", "edit", "test", "--new-name", "test3", "--description", "another description"}, db, &settings)

			Expect(err).To(BeNil())

			entry, idx := db.GetEntry("test3")

			Expect(idx).NotTo(Equal(-1))
			Expect(entry.Name).To(Equal("test3"))
			Expect(entry.Password).To(Equal("mypassword"))
			Expect(entry.Description).To(Equal("another description"))
		})
		It("should edit password", func() {
			pwInput := "testpassword"

			db := passulib.NewPasswordDatabase(pwInput)

			output := ""
			settings := passu.PromptSettings{
				RL: &ReadlineMock{
					"test> ",
					func(p string) string {
						return "newpassword"
					},
				},
				PromptText: "test> ",
				PrintFunc: func(text string) {
					output += text + "\n"
				},
			}

			err := db.AddEntry(passulib.PasswordEntry{
				Name:        "test",
				Password:    "mypassword",
				Description: "description",
			})

			Expect(err).To(BeNil())

			err = passu.RunCommand([]string{"passwords", "edit", "test", "--change-password"}, db, &settings)

			Expect(err).To(BeNil())

			entry, idx := db.GetEntry("test")

			Expect(idx).NotTo(Equal(-1))
			Expect(entry.Password).To(Equal("newpassword"))
		})
	})

	Context("Entry policy override", func() {
		It("should show password entry policy as default", func() {
			pwInput := "testpassword"

			db := passulib.NewPasswordDatabase(pwInput)

			output := ""
			settings := passu.PromptSettings{
				RL: &ReadlineMock{
					"test> ",
					func(p string) string {
						return ""
					},
				},
				PromptText: "test> ",
				PrintFunc: func(text string) {
					output += text + "\n"
				},
			}

			err := db.AddEntry(passulib.PasswordEntry{
				Name:        "test",
				Password:    "mypassword",
				Description: "description",
			})

			Expect(err).To(BeNil())

			err = passu.RunCommand([]string{"passwords", "policy", "view", "test"}, db, &settings)

			Expect(err).To(BeNil())
			Expect(strings.TrimSpace(output)).To(Equal("Length: 32 (default)\nCharacters: lowercase (default), uppercase (default), numbers (default), special characters (default)"))
		})
		It("should show password entry policy", func() {
			pwInput := "testpassword"

			db := passulib.NewPasswordDatabase(pwInput)

			output := ""
			settings := passu.PromptSettings{
				RL: &ReadlineMock{
					"test> ",
					func(p string) string {
						return ""
					},
				},
				PromptText: "test> ",
				PrintFunc: func(text string) {
					output += text + "\n"
				},
			}

			err := db.AddEntry(passulib.PasswordEntry{
				Name:        "test",
				Password:    "mypassword",
				Description: "description",
				PolicyOverride: passulib.PasswordPolicy{
					Length:       null.IntFrom(12),
					UseLowercase: null.BoolFrom(false),
				},
			})

			Expect(err).To(BeNil())

			err = passu.RunCommand([]string{"passwords", "policy", "view", "test"}, db, &settings)

			Expect(err).To(BeNil())
			Expect(strings.TrimSpace(output)).To(Equal("Length: 12\nCharacters: uppercase (default), numbers (default), special characters (default)"))
		})
		It("should change password entry policy", func() {
			pwInput := "testpassword"

			db := passulib.NewPasswordDatabase(pwInput)

			output := ""
			settings := passu.PromptSettings{
				RL: &ReadlineMock{
					"test> ",
					func(p string) string {
						switch p {
						case "Length: ":
							return "14"
						default:
							return ""
						}
					},
				},
				PromptText: "test> ",
				PrintFunc: func(text string) {
					output += text + "\n"
				},
			}

			err := db.AddEntry(passulib.PasswordEntry{
				Name:        "test",
				Password:    "mypassword",
				Description: "description",
				PolicyOverride: passulib.PasswordPolicy{
					Length:       null.IntFrom(12),
					UseLowercase: null.BoolFrom(false),
				},
			})

			Expect(err).To(BeNil())

			err = passu.RunCommand([]string{"passwords", "policy", "change", "test"}, db, &settings)

			Expect(err).To(BeNil())

			entry, idx := db.GetEntry("test")

			Expect(idx).ToNot(Equal(-1))
			Expect(entry.PolicyOverride.Length).To(Equal(null.IntFrom(14)))
			Expect(entry.PolicyOverride.UseLowercase).To(Equal(null.NewBool(false, false)))
		})
		It("should change to default password policy", func() {
			pwInput := "testpassword"

			db := passulib.NewPasswordDatabase(pwInput)

			output := ""
			settings := passu.PromptSettings{
				RL: &ReadlineMock{
					"test> ",
					func(p string) string {
						return ""
					},
				},
				PromptText: "test> ",
				PrintFunc: func(text string) {
					output += text + "\n"
				},
			}

			err := db.AddEntry(passulib.PasswordEntry{
				Name:        "test",
				Password:    "mypassword",
				Description: "description",
				PolicyOverride: passulib.PasswordPolicy{
					Length:       null.IntFrom(12),
					UseLowercase: null.BoolFrom(false),
				},
			})

			Expect(err).To(BeNil())

			err = passu.RunCommand([]string{"passwords", "policy", "change", "test"}, db, &settings)

			Expect(err).To(BeNil())

			entry, idx := db.GetEntry("test")

			Expect(idx).ToNot(Equal(-1))
			Expect(entry.PolicyOverride).To(Equal(passulib.PasswordPolicy{
				Length:       null.Int{},
				UseLowercase: null.Bool{},
				UseUppercase: null.Bool{},
				UseNumbers:   null.Bool{},
				UseSpecial:   null.Bool{},
			}))
		})
	})

	Context("Delete", func() {
		It("should delete password entry", func() {
			pwInput := "testpassword"

			db := passulib.NewPasswordDatabase(pwInput)

			output := ""
			settings := passu.PromptSettings{
				RL: &ReadlineMock{
					"test> ",
					func(p string) string {
						return ""
					},
				},
				PromptText: "test> ",
				PrintFunc: func(text string) {
					output += text + "\n"
				},
			}

			err := db.AddEntry(passulib.PasswordEntry{
				Name:        "test",
				Password:    "mypassword",
				Description: "description",
			})

			Expect(err).To(BeNil())

			err = passu.RunCommand([]string{"passwords", "delete", "test"}, db, &settings)

			Expect(err).To(BeNil())

			_, idx := db.GetEntry("test")

			Expect(idx).To(Equal(-1))
			Expect(strings.TrimSpace(output)).To(Equal("Entry removed"))
		})
	})
})
