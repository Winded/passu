import * as crypto from 'crypto';

const algorithm = 'aes-256-cbc';

function hashPassword(password: string): string {
    return crypto.createHash('md5').update(password).digest('hex');
};

interface PasswordPolicy {
    length?: number;
    useLowercase?: boolean;
    useUppercase?: boolean;
    useNumbers?: boolean;
    useSpecial?: boolean;
}

interface PasswordEntry {
    name: string;
    password: string;
    description: string;
    policyOverride: PasswordPolicy;
}

interface PasswordData {
    passwordPolicy: PasswordPolicy,
    entries: Array<PasswordEntry>,
}

export class PasswordDatabase {
    static fromData(bytes: Buffer, inputPassword: string) {
        let password = hashPassword(inputPassword);

        let ivByteLength = bytes.readUInt8(0);
        let iv = bytes.slice(1, 1 + ivByteLength);

        let edataByteLength = bytes.readUInt32BE(1 + ivByteLength);
        let edata = bytes.slice(1 + ivByteLength + 4, 1 + ivByteLength + 4 + edataByteLength);

        let decipher = crypto.createDecipheriv(algorithm, password, iv);
        let sdata = Buffer.concat([decipher.update(edata), decipher.final()]).toString();

        let data = JSON.parse(sdata);

        let db = new PasswordDatabase(inputPassword);
        db.data = data;

        return db;
    }

    modified: boolean;
    password: string;
    data: PasswordData;

    constructor(inputPassword: string) {
        this.modified = false;

        this.password = hashPassword(inputPassword);

        this.data = {
            passwordPolicy: {
                length: 32,
                useLowercase: true,
                useUppercase: true,
                useNumbers: true,
                useSpecial: true,
            },
            entries: [],
        };
    }

    generatePassword(policyOverride : PasswordPolicy = {}): string {
        let policy = { ...this.data.passwordPolicy, ...policyOverride };

        let characters = '';
        if (policy.useLowercase) {
            characters += 'abcdefghijklmnopqrstuvwxyz';
        }
        if (policy.useUppercase) {
            characters += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        }
        if (policy.useNumbers) {
            characters += '0123456789';
        }
        if (policy.useSpecial) {
            characters += '+-=/\\';
        }

        let password = '';
        for (let i = 0; i < policy.length; i++) {
            password += characters.charAt(Math.floor(Math.random() * characters.length));
        }

        return password;
    }

    findEntries(nameStartsWith: string = ''): Array<PasswordEntry> {
        return this.data.entries.filter((entry) => entry.name.startsWith(nameStartsWith));
    }

    getEntry(name: string): PasswordEntry {
        return this.data.entries.find((entry) => entry.name == name);
    }

    addEntry(name: string, password: string, description: string): void {
        if (!/^[a-zA-Z0-9\-]+$/.test(name)) {
            throw new EvalError('Name must only contain alphabetic characters, numbers and dashes');
        }
        let entry = this.getEntry(name);
        if (entry) {
            throw new Error(`Entry ${name} already exists.`);
        }

        entry = {
            name: name,
            password: password,
            description: description || '',
            policyOverride: {},
        };
        this.data.entries.push(entry);

        this.modified = true;
    }

    updateEntry(name: string, newName: string = null, newPassword: string = null, newDescription: string = null): PasswordEntry {
        let entry = this.getEntry(name);
        if (!entry) {
            throw new Error(`Entry ${name} not found.`);
        }

        if (newName && !/^[a-zA-Z0-9\-]+$/.test(newName)) {
            throw new EvalError('Name must only contain alphabetic characters, numbers and dashes');
        }

        entry.name = newName || entry.name;
        entry.password = newPassword || entry.password;
        entry.description = newDescription || entry.description;

        this.modified = true;
        return entry;
    }

    removeEntry(name: string): PasswordEntry {
        let entry = this.getEntry(name);
        if (!entry) {
            throw new Error(`Entry ${name} not found.`);
        }

        this.data.entries = this.data.entries.filter((e) => e !== entry);
        this.modified = true;
        return entry;
    }

    save(): Buffer {
        let iv = Buffer.from(crypto.randomBytes(16));
        let cypher = crypto.createCipheriv(algorithm, this.password, iv);

        let sdata = JSON.stringify(this.data);
        let edata = Buffer.concat([cypher.update(sdata, 'utf8'), cypher.final()]);

        let bytes = Buffer.alloc(1 + iv.byteLength + 4 + edata.byteLength);
        bytes.writeUInt8(iv.byteLength, 0);
        iv.copy(bytes, 1);
        bytes.writeUInt32BE(edata.byteLength, 1 + iv.byteLength);
        edata.copy(bytes, 1 + iv.byteLength + 4);

        this.modified = false;
        return bytes;
    }
}