import { expect } from 'chai';
import 'mocha';
import { PasswordDatabase } from '../src/passu';
import { createPrompt } from '../src/cli';

describe('CLI commands', () => {
    it('should list passwords', async () => {
        let pwInput = 'testpassword';

        let db = new PasswordDatabase(pwInput);
        let prompt = await createPrompt(db, 'test> ', (_bytes) => {});

        let output = '';
        prompt.pipe((text) => {
            output += text + '\n';
            return '';
        });

        db.addEntry('test', 'mypassword', 'description');

        prompt.execSync('passwords list');

        expect(output.trim()).to.eq('test');
    });
    // TODO
});