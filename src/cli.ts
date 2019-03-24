
import * as fs from 'fs';
import * as path from 'path';
import * as read from 'read';
import * as vorpal from 'vorpal';
import { PasswordDatabase } from './passu';

const passwordPrompt = (prompt : string): Promise<string> => new Promise((resolve : Function, reject : Function) => {
    read({ prompt: prompt, silent: true }, function(er, password) {
        if(er) {
            reject(er);
        } else {
            resolve(password);
        }
    });
});

const loadOrCreateDb = async (pwFile) => {
    if(fs.existsSync(pwFile)) {
        console.log('Opening password file.');

        let bytes = fs.readFileSync(pwFile);
        let pwInput = await passwordPrompt('Master password: ');

        try {
            return PasswordDatabase.fromData(bytes, pwInput);
        } catch(SyntaxError) {
            console.log('Failed to open password file. Either the file is corrupted or you provided an invalid password.');
            return null;
        }
    } else {
        console.log('File does not exist. Creating new password database.');

        let pwInput = await passwordPrompt('Master password: ');
        let pwInputConfirm = await passwordPrompt('Confirm password: ');
        if(pwInput != pwInputConfirm) {
            console.log('ERROR: Passwords do not match.');
            return null;
        }

        return new PasswordDatabase(pwInput);
    }
}

const main = async () => {
    let args = process.argv.slice(2);
    if(args.length < 1) {
        console.log(`Usage: passu [-h, --help] <file>`);
        return;
    }
    else if(args[0] == '-h' || args[0] == '--help') {
        console.log('HEELP');
        return;
    }

    let pwFile = path.resolve(args[0]);

    let db = await loadOrCreateDb(pwFile);
    if(!db) {
        return;
    }

    const dbNameAutocomplete = (input) => {
        return db.findEntries(input).map((entry) => entry.name);
    };

    let prompt = vorpal();

    // Remove default 'exit' command to override it.
    prompt.commands[1].remove();

    prompt.command('passwords list', 'List password entries').alias('pw l')
        .action((_args, cb) => {
            let entries = db.findEntries().map((entry) => entry.name);
            if(entries.length == 0) {
                prompt.log('No entries found');
                cb();
                return;
            }

            entries.forEach((entry) => prompt.log(entry));
            cb();
        });

    prompt.command('passwords new <name> [description]', 'Create new password entry').alias('pw n')
        .action(async (args, cb) => {
            let password = await passwordPrompt('Password (leave empty to generate): ');
            if(!password) {
                password = db.generatePassword();
            }

            try {
                db.addEntry(args.name, password, args.description);
                prompt.log('Password added');
            } catch (err) {
                prompt.log(`Failed to add password entry: ${err}`);
            }
            
            cb();
        });

    prompt.command('passwords show <name>', 'Show password entry').alias('pw s')
        .autocomplete({ data: dbNameAutocomplete })
        .option('-p, --pass-only', 'Only show password')
        .action((args, cb) => {
            let entry = db.getEntry(args.name);
            if(!entry) {
                prompt.log('Entry not found');
                cb();
                return;
            }

            if(args.options['pass-only']) {
                prompt.log(entry.password);
                cb();
                return;
            }
            
            prompt.log(`Name: ${entry.name}`);
            prompt.log(`Password: (${entry.password.length} characters)`);
            prompt.log(`Description: \n ${entry.description || '(none)'}`);

            cb();
        });

    prompt.command('passwords edit <name>', 'Edit a password entry').alias('pw e')
        .autocomplete({ data: dbNameAutocomplete })
        .option('-n, --new-name <newname>', 'Change name of entry')
        .option('-d, --description <newdescription>', 'Change description of entry')
        .option('-p, --change-password', 'Change password')
        .action(async (args, cb) => {
            let entry = db.getEntry(args.name);
            if(!entry) {
                prompt.log('Entry not found');
                cb();
                return;
            }

            let newName = args.options['new-name'] || null;
            let newDescription = args.options.description || null;
            let newPassword = null;

            if(args.options['change-password']) {
                let password = await passwordPrompt('Password (leave empty to generate): ');
                if(!password) {
                    password = db.generatePassword(entry.policyOverride);
                }
                newPassword = password;
            }

            db.updateEntry(args.name, newName, newPassword, newDescription);
            prompt.log('Entry updated');
            cb();
        });

    prompt.command('passwords delete <name>', 'Delete a password entry').alias('pw d')
        .autocomplete({ data: dbNameAutocomplete })
        .action((args, cb) => {
            try {
                db.removeEntry(args.name);
                prompt.log('Entry removed');
            } catch(err) {
                prompt.log(`Error: ${err}`);
            }

            cb();
        });

    prompt.command('save', 'Save the password database to file')
        .action((_args, cb) => {
            let bytes = db.save();
            fs.writeFileSync(pwFile, bytes);
            prompt.log(`Password database saved to ${pwFile}`);
            cb();
        });

    prompt.command('exit').alias('quit')
        .option('-f, --forced', 'Exit without saving')
        .action((args, cb) => {
            if(!args.options.forced && db.modified) {
                prompt.log('Unsaved changes detected. Please save your password database using \'save\', or exit without saving using the \'-f\' option');
                cb();
            }
        });

    prompt
        .delimiter(`${path.basename(pwFile)}> `)
        .show();
};

main();