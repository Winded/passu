package passu_test

type ReadlineMock struct {
	Prompt string
	Answer func(prompt string) string
}

func (this *ReadlineMock) SetPrompt(text string) {
	this.Prompt = text
}

func (this *ReadlineMock) Readline() (string, error) {
	return this.Answer(this.Prompt), nil
}

func (this *ReadlineMock) ReadPassword(prompt string) ([]byte, error) {
	return []byte(this.Answer(prompt)), nil
}
