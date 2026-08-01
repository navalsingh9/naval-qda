const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { initializeDatabase, closeDatabase } = require('./db');
const { importSourceFile } = require('./sources');
const {
  applyCoding,
  createNode,
  getCodingsForSource,
  getNodeTree,
  mergeNodes,
  moveNode,
  percentCoded,
  removeCoding,
} = require('./coding');

function makeTempApp() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'naval-qda-coding-'));
  return {
    tmpDir,
    app: {
      getPath: (name) => {
        if (name === 'userData') return tmpDir;
        throw new Error(`Unexpected path request: ${name}`);
      },
    },
  };
}

test('applyCoding, removeCoding, and percentCoded behave as expected', () => {
  const { app } = makeTempApp();
  initializeDatabase(app);

  const db = require('./db').getDatabase();
  db.prepare('INSERT INTO projects (name) VALUES (?)').run('Project');
  const projectId = db.prepare('SELECT last_insert_rowid() AS id').get().id;
  db.prepare('INSERT INTO coders (project_id, name) VALUES (?, ?)').run(projectId, 'Coder A');
  const coderId = db.prepare('SELECT last_insert_rowid() AS id').get().id;

  const sourceFile = path.join(os.tmpdir(), `coding-source-${Date.now()}.txt`);
  fs.writeFileSync(sourceFile, 'Alpha beta gamma');
  const source = importSourceFile({ projectId, title: 'Sample', filePath: sourceFile });

  const node = createNode({ projectId, name: 'Theme' });

  const coding = applyCoding({
    sourceId: source.id,
    nodeId: node.id,
    coderId,
    startOffset: 0,
    endOffset: 5,
  });

  assert.equal(coding.nodeId, node.id);
  assert.equal(coding.startOffset, 0);
  assert.equal(coding.endOffset, 5);

  const codings = getCodingsForSource(source.id);
  assert.equal(codings.length, 1);
  assert.equal(codings[0].node_id, node.id);

  const coverage = percentCoded(source.id);
  assert.equal(coverage, 5 / 'Alpha beta gamma'.length);

  removeCoding(coding.id);
  assert.equal(getCodingsForSource(source.id).length, 0);

  closeDatabase();
});

test('node tree operations support move and merge', () => {
  const { app } = makeTempApp();
  initializeDatabase(app);
  const db = require('./db').getDatabase();

  db.prepare('INSERT INTO projects (name) VALUES (?)').run('Project');
  const projectId = db.prepare('SELECT last_insert_rowid() AS id').get().id;

  const parent = createNode({ projectId, name: 'Parent' });
  const child = createNode({ projectId, name: 'Child', parentId: parent.id });
  const sibling = createNode({ projectId, name: 'Sibling' });

  moveNode(child.id, sibling.id);
  const tree = getNodeTree(projectId);
  const movedChild = tree.flatMap((root) => [root, ...root.children]).find((entry) => entry.id === child.id);

  assert.equal(movedChild.parentId, sibling.id);

  const merged = mergeNodes(child.id, parent.id);
  assert.equal(merged.deletedNodeId, child.id);

  const postMergeTree = getNodeTree(projectId);
  assert.ok(postMergeTree.some((entry) => entry.id === parent.id));

  closeDatabase();
});
