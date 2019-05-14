# ![alt text](./logo/logo-inline.png) Passu

Passu is a simplistic password manager with a CLI interface. It stores named password entries with optional description to a file, encrypted with a master password.

See [passu-mobile](https://github.com/Winded/passu-mobile) for a mobile application for Passu.

## Installation

```
go get github.com/winded/passu
```

## Usage

```
passu <password file>
```

A new file will be created if the specified path does not have one. An interactive command prompt will be shown. Use the `help` command to view available actions.

You can also execute a single command by putting it after the password file. For example:

```
passu mypasswords.passu pw copy google
```

## Security

See [passu-lib](https://github.com/Winded/passu-lib)