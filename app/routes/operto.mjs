import { exec } from 'child_process';
import path from 'path';
import express from 'express';
const router = express.Router();

router.post('/sync', (req, res) => {
    const scriptDir = path.resolve('app/scripts');
    const setupScript = 'operto-setup.mjs';
    const mongoScript = 'mongo-connect.mjs';

    const fullCommand = `node ${setupScript} && node ${mongoScript}`;

    exec(fullCommand, { cwd: scriptDir }, (error, stdout, stderr) => {
        if (error) {
            console.error('❌ Sync error:', error.message);
            console.error(stderr);
            return res.status(500).json({ success: false, message: 'Script execution failed' });
        }

        console.log(stdout);
        res.json({ success: true });
    });
});

export { router };
