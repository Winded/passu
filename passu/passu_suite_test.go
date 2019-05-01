package passu_test

import (
	"testing"

	. "github.com/onsi/ginkgo"
	. "github.com/onsi/gomega"
)

func TestPassu(t *testing.T) {
	RegisterFailHandler(Fail)
	RunSpecs(t, "Passu Suite")
}
