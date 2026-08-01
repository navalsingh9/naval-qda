const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { initializeDatabase, closeDatabase } = require('./backend/db');
const { createNode, getNodeTree, moveNode } = require('./backend/coding');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'naval-qda-debug-'));
const app = { getPath: (name) => (name === 'userData' ? tmpDir : null) };
initializeDatabase(app);
const db = require('./backend/db').getDatabase();
db.prepare('INSERT INTO projects (name) VALUES (?)').run('Project');
const projectId = db.prepare('SELECT last_insert_rowid() AS id').get().id;
const parent = createNode({ projectId, name: 'Parent' });
const child = createNode({ projectId, name: 'Child', parentId: parent.id });
const sibling = createNode({ projectId, name: 'Sibling' });
moveNode(child.id, sibling.id);
console.log(JSON.stringify(getNodeTree(projectId), null, 2));
closeDatabase();
