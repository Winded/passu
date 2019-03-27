"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const path = require("path");
const read = require("read");
const Vorpal = require("vorpal");
const passu_1 = require("./passu");
const passwordPrompt = (prompt) => new Promise((resolve, reject) => {
    read({ prompt: prompt, silent: true }, function (er, password) {
        if (er) {
            reject(er);
        }
        else {
            resolve(password);
        }
    });
});
const loadOrCreateDb = async (pwFile) => {
    if (fs.existsSync(pwFile)) {
        console.log('Opening password file.');
        let bytes = fs.readFileSync(pwFile);
        let pwInput = await passwordPrompt('Master password: ');
        try {
            return passu_1.PasswordDatabase.fromData(bytes, pwInput);
        }
        catch (SyntaxError) {
            console.log('Failed to open password file. Either the file is corrupted or you provided an invalid password.');
            return null;
        }
    }
    else {
        console.log('File does not exist. Creating new password database.');
        let pwInput = await passwordPrompt('Master password: ');
        let pwInputConfirm = await passwordPrompt('Confirm password: ');
        if (pwInput != pwInputConfirm) {
            console.log('ERROR: Passwords do not match.');
            return null;
        }
        return new passu_1.PasswordDatabase(pwInput);
    }
};
const main = async () => {
    let args = process.argv.slice(2);
    if (args.length < 1) {
        console.log(`Usage: passu [-h, --help] <file>`);
        return;
    }
    else if (args[0] == '-h' || args[0] == '--help') {
        console.log('HEELP');
        return;
    }
    let pwFile = path.resolve(args[0]);
    let db = await loadOrCreateDb(pwFile);
    if (!db) {
        return;
    }
    const dbNameAutocomplete = async () => {
        return db.allEntries().map((entry) => entry.name);
    };
    let prompt = new Vorpal();
    // Remove default 'exit' command to override it.
    // @ts-ignore
    prompt.commands[1].remove();
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
        let password = await passwordPrompt('Password (leave empty to generate): ');
        if (!password) {
            password = db.generatePassword();
        }
        try {
            db.addEntry(args.name, password, args.description);
            prompt.log('Password added');
        }
        catch (err) {
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
            let password = await passwordPrompt('Password (leave empty to generate): ');
            if (!password) {
                password = db.generatePassword(entry.policyOverride);
            }
            newPassword = password;
        }
        db.updateEntry(args.name, newName, newPassword, newDescription);
        prompt.log('Entry updated');
    });
    prompt.command('passwords delete <name>', 'Delete a password entry').alias('pw d')
        .autocomplete({ data: dbNameAutocomplete })
        .action(async (args) => {
        try {
            db.removeEntry(args.name);
            prompt.log('Entry removed');
        }
        catch (err) {
            prompt.log(`Error: ${err}`);
        }
    });
    prompt.command('save', 'Save the password database to file')
        .action(async (_args) => {
        let bytes = db.save();
        fs.writeFileSync(pwFile, bytes);
        prompt.log(`Password database saved to ${pwFile}`);
    });
    prompt.command('exit').alias('quit')
        .option('-f, --forced', 'Exit without saving')
        .action(async (args) => {
        if (!args.options.forced && db.modified) {
            prompt.log('Unsaved changes detected. Please save your password database using \'save\', or exit without saving using the \'-f\' option');
        }
        else {
            prompt.hide();
        }
    });
    prompt
        .delimiter(`${path.basename(pwFile)}> `)
        .show();
};
main();
