// electron-builder afterPack hook (macOS): make the packed .app signable and runnable.
//
// 1. Strip extended attributes. The project may live in an iCloud-synced folder
//    (Desktop/Documents), which tags files with FinderInfo / file-provider attributes
//    that codesign rejects as "resource fork, Finder information, or similar detritus".
// 2. Without a Developer ID (NOCAP_SIGNING unset), ad-hoc sign the whole bundle: Apple
//    Silicon refuses to run unsigned code. Users then confirm it once in System
//    Settings → Privacy & Security. With NOCAP_SIGNING=developer-id, electron-builder
//    signs and notarizes right after this hook, so only step 1 runs.
const { execFileSync } = require('node:child_process');
const path = require('node:path');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;
  const app = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  execFileSync('xattr', ['-cr', app], { stdio: 'inherit' });
  if (process.env.NOCAP_SIGNING === 'developer-id') return;
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', app], { stdio: 'inherit' });
  execFileSync('codesign', ['--verify', '--deep', '--strict', app], { stdio: 'inherit' });
  console.log(`  • ad-hoc signed ${path.basename(app)}`);
};
