var gulp = require('gulp'),
    prompt = require('gulp-prompt'),
    rename = require('gulp-rename'),
    clean = require('gulp-clean'),
    del = require('del');
gulp.task('switch', function() {
    return gulp.src('.enb/make.js')
        .pipe(prompt.prompt({
            type: 'input',
            name: 'preproc',
            message: 'CHOOSE YOUR PREPROCESSOR (SASS || PCSS || STYL)?'
        }, function(res){
            return gulp.src('.enb/cssTechs/make' + res.preproc.toUpperCase() + '.js')
                .pipe(rename('make.js'))
                .pipe(gulp.dest('.enb'));
        }))

})
gulp.task('prepare', function(){
    return del('node_modules/bem-core/common.blocks/jquery/**', {force:true});
});