import gulp from 'gulp';
import ghPages from 'gulp-gh-pages';
import plumber from 'gulp-plumber';
import notify from 'gulp-notify';
import rename from 'gulp-rename';
import fileInclude from "gulp-file-include";
import replace from "gulp-replace";
import gulpIf from 'gulp-if';
import dartSass from "sass";
import gulpSass from "gulp-sass";
import sourcemaps from "gulp-sourcemaps";
import postcss from 'gulp-postcss';
import postUrl from 'postcss-url';
import autoprefixer from 'autoprefixer';
import csso from 'postcss-csso';
import terser from 'gulp-terser';
import squoosh from 'gulp-libsquoosh';
import svgo from 'gulp-svgmin';
import { stacksvg } from "gulp-stacksvg";
import { deleteAsync } from 'del';
import browser from 'browser-sync';
import bemlinter from 'gulp-html-bemlinter';
import { htmlValidator } from "gulp-w3c-html-validator";

const sass = gulpSass(dartSass);
let isDevelopment = true;

export function processMarkup() {
  return gulp.src('source/*.html')
    .pipe(plumber(
      notify.onError({
        title: "HTML",
        message: "Error: <%= error.message %>"
      })))
    .pipe(fileInclude())
    .pipe(replace(/@img\//g, 'img/'))
    .pipe(gulp.dest('build'));
}

export function lintBem() {
  return gulp.src('source/*.html')
    .pipe(bemlinter());
}

export function validateMarkup() {
  return gulp.src('source/*.html')
    .pipe(htmlValidator.analyzer())
    .pipe(htmlValidator.reporter({ throwErrors: true }));
}

export function processStyles() {
  return gulp.src('source/sass/*.scss')
    .pipe(plumber(
      notify.onError({
        title: "SCSS",
        message: "Error: <%= error.message %>"
      })))
    .pipe(sourcemaps.init())
    .pipe(sass().on('error', sass.logError))
    .pipe(postcss([
      postUrl({ assetsPath: '../' }),
      autoprefixer(),
      csso()
    ]))
    .pipe(rename('style.min.css'))
    .pipe(sourcemaps.write(''))
    .pipe(gulp.dest('build/css'))
    .pipe(browser.stream());
}

export function processScripts() {
  return gulp.src('source/js/**/*.js')
    .pipe(plumber(
      notify.onError({
        title: "JS",
        message: "Error: <%= error.message %>"
      })))
    .pipe(terser())
    .pipe(gulp.dest('build/js'))
    .pipe(browser.stream());
}

export function optimizeImages() {
  return gulp.src('source/img/**/*.{png,jpg}')
    .pipe(gulpIf(!isDevelopment, squoosh()))
    .pipe(gulp.dest('build/img'))
}

export function createWebp() {
  return gulp.src('source/img/**/*.{png,jpg}')
    .pipe(squoosh({
      webp: {}
    }))
    .pipe(gulp.dest('build/img'))
}

export function optimizeVector() {
  return gulp.src(['source/img/**/*.svg', '!source/img/icons/**/*.svg'])
    .pipe(svgo())
    .pipe(gulp.dest('build/img'));
}

export function createStack() {
  return gulp.src('source/img/icons/**/*.svg')
    .pipe(svgo())
    .pipe(stacksvg())
    .pipe(gulp.dest('build/img/icons'));
}

export function copyAssets() {
  return gulp.src([
    'source/fonts/**/*.{woff2,woff}',
    'source/*.ico',
    'source/*.webmanifest',
  ], {
    base: 'source'
  })
    .pipe(gulp.dest('build'));
}

export function startServer(done) {
  browser.init({
    server: {
      baseDir: 'build'
    },
    cors: true,
    notify: false,
    ui: false,
  });
  done();
}

function reloadServer(done) {
  browser.reload();
  done();
}

function watchFiles() {
  gulp.watch('source/sass/**/*.scss', gulp.series(processStyles), reloadServer);
  gulp.watch('source/js/script.js', gulp.series(processScripts, reloadServer));
  gulp.watch('source/*.html', gulp.series(processMarkup, reloadServer));
}

function compileProject(done) {
  gulp.parallel(
    processMarkup,
    processStyles,
    processScripts,
    optimizeVector,
    createStack,
    copyAssets,
    optimizeImages,
    createWebp
  )(done);
}

function deleteBuild() {
  return deleteAsync('build');
}

export function buildProd(done) {
  isDevelopment = false;
  gulp.series(
    deleteBuild,
    compileProject
  )(done);
}

export function runDev(done) {
  gulp.series(
    deleteBuild,
    compileProject,
    startServer,
    watchFiles
  )(done);
}

gulp.task('deploy', function () {
  return gulp.src('./build/**/*')
    .pipe(ghPages());
});
