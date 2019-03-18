const crypto = require('crypto');

const algorithm = 'aes-256-cbc';

let passu = {};

passu.createNewDatabase = (password) => {
    let db = {
        password = password,
        data = {
            passwordPolicy = {
                length = 32,
                useLowercase = true,
                useUppercase = true,
                useNumbers = true,
                useSpecial = true,
            },
            entries = [],
        },
    };

    return db;
};

passu.loadDatabase = (bytes, password) => {
    
};

passu.saveDatabase = (db) => {
    let iv = new Buffer(crypto.randomBytes(16));
    let cypher = crypto.createCipheriv(algorithm, db.password, iv);

    let sdata = JSON.stringify(db.data);
    let bytes = cypher.update(sdata, 'utf8', 'binary');
    bytes += cypher.final('binary');

    return iv + bytes;
};

module.exports = passu;