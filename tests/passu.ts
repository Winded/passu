import { expect } from 'chai';
import 'mocha';
import { PasswordDatabase } from '../src/passu';

describe('Database encryption and decryption', () => {
    it('should encrypt and decrypt the database successfully', () => {
        let pwInput = 'testpassword';

        let db = new PasswordDatabase(pwInput);
        db.addEntry('test', 'mypassword', 'description');

        let bytes = db.save();

        let decryptedDb = PasswordDatabase.fromData(bytes, pwInput);
        let entry = decryptedDb.data.entries[0];
        
        expect(entry.name).to.eq('test');
        expect(entry.password).to.eq('mypassword');
        expect(entry.description).to.eq('description');
    });
});

describe('Password generation', () => {
    it('should generate password with default password policy', () => {
        let pwInput = 'testpassword';

        let db = new PasswordDatabase(pwInput);
        let entry = db.addEntry('test', db.generatePassword(), 'description');
        
        expect(entry.password.length).to.eq(32);
    });

    it('should generate password with specified password policy', () => {
        let pwInput = 'testpassword';

        let db = new PasswordDatabase(pwInput);
        let entry = db.addEntry('test', db.generatePassword({
            length: 16,
            useLowercase: true,
            useNumbers: true,
            useUppercase: false,
            useSpecial: false,
        }), 'description');
        
        expect(entry.password.length).to.eq(16);
        expect(/[a-z]/.test(entry.password)).to.eq(true);
        expect(/[A-Z\+\-\=\/\\]/.test(entry.password)).to.eq(false);
    });
});