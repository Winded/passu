"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
require("mocha");
const passu_1 = require("../src/passu");
describe('Database encryption and decryption', () => {
    it('should encrypt and decrypt the database successfully', () => {
        let pwInput = 'testpassword';
        let db = new passu_1.PasswordDatabase(pwInput);
        db.addEntry('test', 'mypassword', 'description');
        let bytes = db.save();
        let decryptedDb = passu_1.PasswordDatabase.fromData(bytes, pwInput);
        let entry = decryptedDb.data.entries[0];
        chai_1.expect(entry.name).to.eq('test');
        chai_1.expect(entry.password).to.eq('mypassword');
        chai_1.expect(entry.description).to.eq('description');
    });
});
describe('Password generation', () => {
    it('should generate password with default password policy', () => {
        let pwInput = 'testpassword';
        let db = new passu_1.PasswordDatabase(pwInput);
        let entry = db.addEntry('test', db.generatePassword(), 'description');
        chai_1.expect(entry.password.length).to.eq(32);
    });
    it('should generate password with specified password policy', () => {
        let pwInput = 'testpassword';
        let db = new passu_1.PasswordDatabase(pwInput);
        let entry = db.addEntry('test', db.generatePassword({
            length: 16,
            useLowercase: true,
            useNumbers: true,
            useUppercase: false,
            useSpecial: false,
        }), 'description');
        chai_1.expect(entry.password.length).to.eq(16);
        chai_1.expect(/[a-z]/.test(entry.password)).to.eq(true);
        chai_1.expect(/[A-Z\+\-\=\/\\]/.test(entry.password)).to.eq(false);
    });
});
