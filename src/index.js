const crypto = require('crypto');

const algorithm = 'aes-256-cbc';

let passu = {};

passu.hashPassword = (password) => {
    return crypto.createHash('md5').update(password).digest('hex');
};

passu.createNewDatabase = (password) => {
    let db = {
        password: password,
        data: {
            passwordPolicy: {
                length: 32,
                useLowercase: true,
                useUppercase: true,
                useNumbers: true,
                useSpecial: true,
            },
            entries: [],
        },
    };

    return db;
};

passu.loadDatabase = (bytes, password) => {
    let ivByteLength = bytes.readUInt8(0);
    let iv = bytes.slice(1, 1 + ivByteLength);

    let edataByteLength = bytes.readUInt32BE(1 + ivByteLength);
    let edata = bytes.slice(1 + ivByteLength + 4, 1 + ivByteLength + 4 + edataByteLength);

    let decipher = crypto.createDecipheriv(algorithm, password, iv);
    let sdata = Buffer.concat([decipher.update(edata), decipher.final()]).toString();

    let data = JSON.parse(sdata);

    return {
        password: password,
        data: data,
    };
};

passu.saveDatabase = (db) => {
    let iv = Buffer.from(crypto.randomBytes(16));
    let cypher = crypto.createCipheriv(algorithm, db.password, iv);

    let sdata = JSON.stringify(db.data);
    let edata = Buffer.concat([cypher.update(sdata, 'utf8'), cypher.final()]);
    
    let bytes = Buffer.alloc(1 + iv.byteLength + 4 + edata.byteLength);
    bytes.writeUInt8(iv.byteLength, 0);
    iv.copy(bytes, 1);
    bytes.writeUInt32BE(edata.byteLength, 1 + iv.byteLength);
    edata.copy(bytes, 1 + iv.byteLength + 4);

    return bytes;
};

module.exports = passu;