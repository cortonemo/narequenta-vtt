const gulp = require('gulp');
const less = require('gulp-less');

/* ----------------------------------------- */
/* Compile LESS
/* ----------------------------------------- */

// Update the constant to match your new file structure
const SYSTEM_LESS = ["styles/*.less"];

function compileLESS() {
  // Changed from "simple.less" to "narequenta.less"
  return gulp.src("styles/narequenta.less")
    .pipe(less())
    .pipe(gulp.dest("./styles/"))
}

const css = gulp.series(compileLESS);

/* ----------------------------------------- */
/* Watch Updates
/* ----------------------------------------- */

function watchUpdates() {
  gulp.watch(SYSTEM_LESS, css);
}

/* ----------------------------------------- */
/* Export Tasks
/* ----------------------------------------- */

exports.default = gulp.series(
  gulp.parallel(css),
  watchUpdates
);
exports.css = css;