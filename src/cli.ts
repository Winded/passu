import * as fs from 'fs';
import * as path from 'path';
import * as read from 'read';
import * as Vorpal from 'vorpal';
import { PasswordDatabase, PasswordPolicy } from './passu';
import * as clipboardy from 'clipboardy';

const passwordPrompt = (prompt: string): Promise<string> => new Promise((resolve, reject) => {
    read({ prompt: prompt, silent: true, replace: '*' }, function (er, password) {
        if (er) {
            reject(er);
        } else {
            resolve(password);
        }
    });
});

export async function loadOrCreateDb(pwFile: string): Promise<PasswordDatabase> {
    if (fs.existsSync(pwFile)) {
        console.log('Opening password file.');

        let bytes = fs.readFileSync(pwFile);
        let pwInput = await passwordPrompt('Master password: ');

        try {
            return PasswordDatabase.fromData(bytes, pwInput);
        } catch (SyntaxError) {
            console.log('Failed to open password file. Either the file is corrupted or you provided an invalid password.');
            return null;
        }
    } else {
        console.log('File does not exist. Creating new password database.');

        let pwInput = await passwordPrompt('Master password: ');
        let pwInputConfirm = await passwordPrompt('Confirm password: ');
        if (pwInput != pwInputConfirm) {
            console.log('ERROR: Passwords do not match.');
            return null;
        }

        return new PasswordDatabase(pwInput);
    }
}

export async function createPrompt(db: PasswordDatabase, delimiter: string, writeFileFunc: (bytes: Buffer) => void, 
        readPasswordFunc: (prompt: string) => Promise<string>): Promise<Vorpal> {
    const dbNameAutocomplete = async () => {
        return db.allEntries().map((entry) => entry.name);
    };

    let prompt = new Vorpal();

    // Remove default 'exit' command to override it.
    // @ts-ignore
    prompt.commands[1].remove();

    prompt.command('default-policy view', 'View default policy').alias('dp v')
        .action(async (_args) => {
            let policy = db.defaultPolicy;
            prompt.log(`Length: ${policy.length}`);
            prompt.log(`Lowercase: ${policy.useLowercase ? 'yes' : 'no'}`);
            prompt.log(`Uppercase: ${policy.useUppercase ? 'yes' : 'no'}`);
            prompt.log(`Numbers: ${policy.useNumbers ? 'yes' : 'no'}`);
            prompt.log(`Special characters: ${policy.useSpecial ? 'yes' : 'no'}`);
        });
    prompt.command('default-policy change', 'Change default policy').alias('dp c')
        .option('-l, --length <value>', 'Length of generated passwords')
        .option('-lo, --use-lowercase <value>', 'Use lowercase characters in generated passwords')
        .option('-u, --use-uppercase <value>', 'Use uppercase characters in generated passwords')
        .option('-n, --use-numbers <value>', 'Use numbers in generated passwords')
        .option('-s, --use-special <value>', 'Use special characters in generated passwords')
        .action(async (args) => {
            let defaultPolicy = db.defaultPolicy;
            let newLength = parseInt(args.options['length']);
            try {
                db.defaultPolicy = {
                    length: !isNaN(newLength) ? newLength : defaultPolicy.length,
                    useLowercase: args.options['use-lowercase'] !== undefined
                        ? args.options['use-lowercase'] ? true : false
                        : defaultPolicy.useLowercase,
                    useUppercase: args.options['use-uppercase'] !== undefined
                        ? args.options['use-uppercase'] ? true : false
                        : defaultPolicy.useUppercase,
                    useNumbers: args.options['use-numbers'] !== undefined
                        ? args.options['use-numbers'] ? true : false
                        : defaultPolicy.useNumbers,
                    useSpecial: args.options['use-special'] !== undefined
                        ? args.options['use-special'] ? true : false
                        : defaultPolicy.useSpecial,
                };
            } catch(err) {
                prompt.log(`ERROR: ${err}`);
            }

            prompt.log('Default policy updated');
        });

    prompt.command('passwords list', 'List password entries').alias('pw l')
        .action(async (_args) => {
            let entries = db.findEntries().map((entry) => entry.name);
            if (entries.length == 0) {
                prompt.log('No entries found');
                return;
            }

            entries.forEach((entry) => prompt.log(entry));
        });

    prompt.command('passwords new <name> [description]', 'Create new password entry').alias('pw n')
        .action(async (args) => {
            let password = await readPasswordFunc('Password (leave empty to generate): ');

            try {
                db.addEntry(args.name, password, args.description);
                if (!password) {
                    db.generatePassword(args.name);
                }
                prompt.log('Password added');
            } catch (err) {
                prompt.log(`Failed to add password entry: ${err}`);
            }
        });

    prompt.command('passwords show <name>', 'Show password entry').alias('pw s')
        .autocomplete({ data: dbNameAutocomplete })
        .option('-p, --pass-only', 'Only show password')
        .action(async (args) => {
            let entry = db.getEntry(args.name);
            if (!entry) {
                prompt.log('Entry not found');
                return;
            }

            if (args.options['pass-only']) {
                prompt.log(entry.password);
                return;
            }

            prompt.log(`Name: ${entry.name}`);
            prompt.log(`Password: (${entry.password.length} characters)`);
            prompt.log(`Description: \n ${entry.description || '(none)'}`);
        });

    prompt.command('passwords copy <name>', 'Copy password to clipboard').alias('pw c')
        .autocomplete({ data: dbNameAutocomplete })
        .action(async (args) => {
            let entry = db.getEntry(args.name);
            if (!entry) {
                prompt.log('Entry not found');
                return;
            }
            
            try {
                await clipboardy.write(entry.password);
                prompt.log('Password copied to clipboard.');
            } catch(err) {
                prompt.log('Copy failed. Your environment may not have a clipboard, or is unsupported.');
            }
        });

    prompt.command('passwords edit <name>', 'Edit a password entry').alias('pw e')
        .autocomplete({ data: dbNameAutocomplete })
        .option('-n, --new-name <newname>', 'Change name of entry')
        .option('-d, --description <newdescription>', 'Change description of entry')
        .option('-p, --change-password', 'Change password')
        .action(async (args) => {
            let entry = db.getEntry(args.name);
            if (!entry) {
                prompt.log('Entry not found');
                return;
            }

            let newName = args.options['new-name'] || null;
            let newDescription = args.options.description || null;
            let newPassword = null;

            if (args.options['change-password']) {
                newPassword = await readPasswordFunc('Password (leave empty to generate): ');
            }

            db.updateEntry(args.name, newName, newPassword, newDescription);

            if (args.options['change-password'] && !newPassword) {
                db.generatePassword(args.name);
            }

            prompt.log('Entry updated');
        });

    prompt.command('passwords policy view <name>', 'Show password policy of entry').alias('pw p v')
        .autocomplete({ data: dbNameAutocomplete })
        .action(async (args) => {
            let entry = db.getEntry(args.name);
            if (!entry) {
                prompt.log('Entry not found');
                return;
            }

            let policy = entry.policyOverride;
            const printPolicyBool = (key: string): string => {
                return policy[key] !== undefined ? (policy[key] ? 'yes' : 'no') : (db.defaultPolicy[key] ? 'yes' : 'no') + ' (default)';
            };

            prompt.log(`Length: ${policy.length !== undefined ? policy.length : db.defaultPolicy.length + ' (default)'}`);
            prompt.log(`Lowercase: ${printPolicyBool('useLowercase')}`);
            prompt.log(`Uppercase: ${printPolicyBool('useUppercase')}`);
            prompt.log(`Numbers: ${printPolicyBool('useNumbers')}`);
            prompt.log(`Special characters: ${printPolicyBool('useSpecial')}`);
        });
    prompt.command('passwords policy change <name>', 'Change password policy of entry').alias('pw p c')
        .autocomplete({ data: dbNameAutocomplete })
        .option('-l, --length <value>', 'Length of generated passwords')
        .option('-lo, --use-lowercase <value>', 'Use lowercase characters in generated passwords')
        .option('-u, --use-uppercase <value>', 'Use uppercase characters in generated passwords')
        .option('-n, --use-numbers <value>', 'Use numbers in generated passwords')
        .option('-s, --use-special <value>', 'Use special characters in generated passwords')
        .option('-rl, --reset-length', 'Reset length to default policy')
        .option('-rlc, --reset-use-lowercase', 'Reset lowercase usage to default policy')
        .option('-ruc, --reset-use-uppercase', 'Reset uppercase usage to default policy')
        .option('-rn, --reset-use-numbers', 'Reset numbers usage to default policy')
        .option('-rs, --reset-use-special', 'Reset special characters usage to default policy')
        .action(async (args) => {
            let entry = db.getEntry(args.name);
            if (!entry) {
                prompt.log('Entry not found');
                return;
            }

            let oldPolicy = entry.policyOverride;
            const getPolicyBoolValue = (key: string, optKey: string, optResetKey: string): boolean => {
                return !args.options[optResetKey] ? args.options[optKey] !== undefined
                        ? args.options[optKey] ? true : false
                        : oldPolicy[key]
                    : undefined;
            };

            let newLength = parseInt(args.options['length']);
            try {
                let newPolicy: PasswordPolicy = {
                    length: !args.options['reset-length'] ? !isNaN(newLength)
                            ? newLength
                            : oldPolicy.length
                        : undefined,
                    useLowercase: getPolicyBoolValue('useLowercase', 'use-lowercase', 'reset-use-lowercase'),
                    useUppercase: getPolicyBoolValue('useUppercase', 'use-uppercase', 'reset-use-uppercase'),
                    useNumbers: getPolicyBoolValue('useNumbers', 'use-numbers', 'reset-use-numbers'),
                    useSpecial: getPolicyBoolValue('useSpecial', 'use-special', 'reset-use-special'),
                };

                db.updateEntry(entry.name, null, null, null, newPolicy);
            } catch(err) {
                prompt.log(`ERROR: ${err}`);
            }

            prompt.log('Entry policy updated');
        });

    prompt.command('passwords delete <name>', 'Delete a password entry').alias('pw d')
        .autocomplete({ data: dbNameAutocomplete })
        .action(async (args) => {
            try {
                db.removeEntry(args.name);
                prompt.log('Entry removed');
            } catch (err) {
                prompt.log(`Error: ${err}`);
            }
        });

    prompt.command('save', 'Save the password database to file')
        .action(async (_args) => {
            let bytes = db.save();
            writeFileFunc(bytes);
        });

    prompt.command('exit').alias('quit')
        .option('-f, --forced', 'Exit without saving')
        .action(async (args) => {
            if (!args.options.forced && db.modified) {
                prompt.log('Unsaved changes detected. Please save your password database using \'save\', or exit without saving using the \'-f\' option');
            } else {
                prompt.hide();
            }
        });

    prompt
        .delimiter(delimiter);

    return prompt;
}

export async function runPrompt(args: Array<string>): Promise<void> {
    if (args.length < 1) {
        console.log(`Usage: passu <file>`);
        return;
    }

    let pwFile = path.resolve(args[0]);

    let db = await loadOrCreateDb(pwFile);
    if (!db) {
        return;
    }

    let prompt = await createPrompt(db, `${path.basename(pwFile)}> `, (bytes) => {
        fs.writeFileSync(pwFile, bytes);
        prompt.log(`Password database saved to ${pwFile}`);
    }, passwordPrompt);

    prompt.show();
};