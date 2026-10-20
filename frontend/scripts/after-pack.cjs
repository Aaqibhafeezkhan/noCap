// electron-builder afterPack hook (macOS): make the packed .app signable and runnable.
//
// 1. Strip extended attributes. The project may live in an iCloud-synced folder
//    (Desktop/Documents), which tags files with FinderInfo / file-provider attributes
//    that codesign rejects as "resource fork, Finder information, or similar detritus".
// 2. Ad-hoc sign the whole bundle. Apple Silicon refuses to run unsigned code, and the
//    app is not Developer ID signed (electron-builder signing is disabled in
//    electron-builder.yml), so an ad-hoc signature is what lets it start. Users still
//    confirm it once in System Settings → Privacy & Security (no notarization).
const { execFileSync } = require('node:child_process');
const path = require('node:path');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;
  const app = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  execFileSync('xattr', ['-cr', app], { stdio: 'inherit' });
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', app], { stdio: 'inherit' });
  execFileSync('codesign', ['--verify', '--deep', '--strict', app], { stdio: 'inherit' });
  console.log(`  • ad-hoc signed ${path.basename(app)}`);
};
