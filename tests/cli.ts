import { expect } from 'chai';
import 'mocha';
import { PasswordDatabase } from '../src/passu';
import { createPrompt } from '../src/cli';
import * as events from 'events';
import * as clipboardy from 'clipboardy';
import { platform } from 'os';

describe('CLI commands', () => {

    before(() => {
        events.EventEmitter.defaultMaxListeners = 100;
    });

    context('Change master password', () => {
        it('should change master password of database', async () => {
            let db = new PasswordDatabase('testpassword');
            db.addEntry('test', 'test', 'test');
    
            let prompt = await createPrompt(db, 'test> ', (_bytes) => {}, async () => 'anotherpassword');
    
            let output = '';
            prompt.pipe((text) => {
                output += text + '\n';
                return '';
            });
    
            await prompt.exec('change-master-password');

            expect(output.trim()).to.eq(`Master password changed. Please save the database to use the new password.`);

            let bytes = db.save();
            db = PasswordDatabase.fromData(bytes, 'anotherpassword');
            let entry = db.getEntry('test');
    
            expect(entry).to.not.equal(undefined);
        });
    });

    context('Default Policy', () => {
        it('should view default policy', async () => {
            let pwInput = 'testpassword';
    
            let db = new PasswordDatabase(pwInput);
            db.defaultPolicy = {
                length: 16,
                useLowercase: false,
                useUppercase: true,
                useNumbers: true,
                useSpecial: true,
            };
    
            let prompt = await createPrompt(db, 'test> ', (_bytes) => {}, async () => '');
    
            let output = '';
            prompt.pipe((text) => {
                output += text + '\n';
                return '';
            });
    
            prompt.execSync('default-policy view');
    
            expect(output.trim()).to.eq(`Length: 16\nLowercase: no\nUppercase: yes\nNumbers: yes\nSpecial characters: yes`);
        });
    
        it('should change default policy', async () => {
            let pwInput = 'testpassword';
    
            let db = new PasswordDatabase(pwInput);
            db.defaultPolicy = {
                length: 16,
                useLowercase: false,
                useUppercase: true,
                useNumbers: true,
                useSpecial: true,
            };
    
            let prompt = await createPrompt(db, 'test> ', (_bytes) => {}, async () => '');
    
            let output = '';
            prompt.pipe((text) => {
                output += text + '\n';
                return '';
            });
    
            prompt.execSync('default-policy change --length 24 --use-lowercase 1 --use-uppercase 0 --use-numbers 1 --use-special 0');
    
            expect(output.trim()).to.eq(`Default policy updated`);
            expect(db.defaultPolicy).to.include({
                length: 24,
                useLowercase: true,
                useUppercase: false,
                useNumbers: true,
                useSpecial: false,
            });
        });
    });

    context('List/Show', () => {
        it('should list passwords', async () => {
            let pwInput = 'testpassword';
    
            let db = new PasswordDatabase(pwInput);
            let prompt = await createPrompt(db, 'test> ', (_bytes) => {}, async () => '');
    
            let output = '';
            prompt.pipe((text) => {
                output += text + '\n';
                return '';
            });
    
            db.addEntry('test', 'mypassword', 'description');
    
            prompt.execSync('passwords list');
    
            expect(output.trim()).to.eq('test');
        });
        it('should show password entry details', async () => {
            let pwInput = 'testpassword';
    
            let db = new PasswordDatabase(pwInput);
            let prompt = await createPrompt(db, 'test> ', (_bytes) => {}, async () => '');
    
            let output = '';
            prompt.pipe((text) => {
                output += text + '\n';
                return '';
            });
    
            db.addEntry('test', 'mypassword', 'description');
    
            prompt.execSync('passwords show test');
    
            let entry = db.getEntry('test');
            expect(output.trim()).to.eq(`Name: ${entry.name}\nPassword: (${entry.password.length} characters)\nDescription: \n ${entry.description || '(none)'}`);
        });
        it('should show password', async () => {
            let pwInput = 'testpassword';
    
            let db = new PasswordDatabase(pwInput);
            let prompt = await createPrompt(db, 'test> ', (_bytes) => {}, async () => '');
    
            let output = '';
            prompt.pipe((text) => {
                output += text + '\n';
                return '';
            });
    
            db.addEntry('test', 'mypassword', 'description');
    
            prompt.execSync('passwords show test --pass-only');
    
            expect(output.trim()).to.eq('mypassword');
        });

        it('should copy password to clipboard', async () => {
            let pwInput = 'testpassword';
    
            let db = new PasswordDatabase(pwInput);
            let prompt = await createPrompt(db, 'test> ', (_bytes) => {}, async () => '');
    
            let output = '';
            prompt.pipe((text) => {
                output += text + '\n';
                return '';
            });
    
            db.addEntry('test', 'mypassword', 'description');
    
            let oldData = await clipboardy.read();

            await prompt.exec('passwords copy test');
    
            expect(await clipboardy.read()).to.eq('mypassword');

            await clipboardy.write(oldData);
        });
    });

    context('Create/Edit/Delete', () => {
        it('should create new password entry', async () => {
            let pwInput = 'testpassword';
    
            let db = new PasswordDatabase(pwInput);
            let prompt = await createPrompt(db, 'test> ', (_bytes) => {}, async () => 'mypassword');
    
            let output = '';
            prompt.pipe((text) => {
                output += text + '\n';
                return '';
            });
    
            await prompt.exec('passwords new test description');
    
            let entry = db.getEntry('test');
            expect(entry).to.not.eq(undefined);
            expect(entry.name).to.eq('test');
            expect(entry.password).to.eq('mypassword');
            expect(entry.description).to.eq('description');
            expect(output.trim()).to.eq('Password added');
        });
    
        it('should edit password entry', async () => {
            let pwInput = 'testpassword';
    
            let db = new PasswordDatabase(pwInput);
            let prompt = await createPrompt(db, 'test> ', (_bytes) => {}, async () => '');
    
            let output = '';
            prompt.pipe((text) => {
                output += text + '\n';
                return '';
            });
    
            db.addEntry('test', 'mypassword', 'description');
    
            prompt.execSync('passwords edit test --new-name test3 --description "another description"');
    
            let entry = db.getEntry('test3');
    
            expect(entry).to.not.eq(undefined);
            expect(entry.name).to.eq('test3');
            expect(entry.description).to.eq('another description');
            expect(output.trim()).to.eq('Entry updated');
        });
        it('should edit password', async () => {
            let pwInput = 'testpassword';
    
            let db = new PasswordDatabase(pwInput);
            let prompt = await createPrompt(db, 'test> ', (_bytes) => {}, async () => 'newpassword');
    
            let output = '';
            prompt.pipe((text) => {
                output += text + '\n';
                return '';
            });
    
            db.addEntry('test', 'mypassword', 'description');
    
            await prompt.exec('passwords edit test --change-password');
    
            let entry = db.getEntry('test');
            expect(entry).to.not.eq(undefined);
            expect(entry.password).to.eq('newpassword');
            expect(output.trim()).to.eq('Entry updated');
        });
    });

    context('Entry policy override', () => {
        it('should show password entry policy as default', async () => {
            let pwInput = 'testpassword';
    
            let db = new PasswordDatabase(pwInput);
            let prompt = await createPrompt(db, 'test> ', (_bytes) => {}, async () => '');
    
            let output = '';
            prompt.pipe((text) => {
                output += text + '\n';
                return '';
            });
    
            db.addEntry('test', 'mypassword', 'description');
    
            prompt.execSync('passwords policy view test');
    
            expect(output.trim()).to.eq(`Length: 32 (default)\nLowercase: yes (default)\nUppercase: yes (default)\nNumbers: yes (default)\nSpecial characters: yes (default)`);
        });
        it('should show password entry policy', async () => {
            let pwInput = 'testpassword';
    
            let db = new PasswordDatabase(pwInput);
            let prompt = await createPrompt(db, 'test> ', (_bytes) => {}, async () => '');
    
            let output = '';
            prompt.pipe((text) => {
                output += text + '\n';
                return '';
            });
    
            db.addEntry('test', 'mypassword', 'description', {
                length: 12,
                useLowercase: false,
            });
    
            await prompt.exec('passwords policy view test');
    
            expect(output.trim()).to.eq(`Length: 12\nLowercase: no\nUppercase: yes (default)\nNumbers: yes (default)\nSpecial characters: yes (default)`);
        });

        it('should change password entry policy', async () => {
            let pwInput = 'testpassword';
    
            let db = new PasswordDatabase(pwInput);
            let prompt = await createPrompt(db, 'test> ', (_bytes) => {}, async () => '');
    
            let output = '';
            prompt.pipe((text) => {
                output += text + '\n';
                return '';
            });
    
            db.addEntry('test', 'mypassword', 'description', {
                length: 12,
                useLowercase: false,
            });
    
            await prompt.exec('passwords policy change test --length 14 --reset-use-lowercase');
    
            let entry = db.getEntry('test');
            expect(entry.policyOverride.length).to.eq(14);
            expect(entry.policyOverride.useLowercase).to.eq(undefined);
        });
        it('should not change anything password entry policy', async () => {
            let pwInput = 'testpassword';
    
            let db = new PasswordDatabase(pwInput);
            let prompt = await createPrompt(db, 'test> ', (_bytes) => {}, async () => '');
    
            let output = '';
            prompt.pipe((text) => {
                output += text + '\n';
                return '';
            });
    
            db.addEntry('test', 'mypassword', 'description', {
                length: 12,
                useLowercase: false,
            });
    
            await prompt.exec('passwords policy change test');
    
            let entry = db.getEntry('test');
            expect(entry.policyOverride.length).to.eq(12);
            expect(entry.policyOverride.useLowercase).to.eq(false);
        });
    });

    context('Delete', () => {
        it('should delete password entry', async () => {
            let pwInput = 'testpassword';
    
            let db = new PasswordDatabase(pwInput);
            let prompt = await createPrompt(db, 'test> ', (_bytes) => {}, async () => '');
    
            let output = '';
            prompt.pipe((text) => {
                output += text + '\n';
                return '';
            });
    
            db.addEntry('test', 'mypassword', 'description');
    
            prompt.execSync('passwords delete test');
    
            expect(db.getEntry('test')).to.eq(undefined);
            expect(output.trim()).to.eq('Entry removed');
        });
    });
});