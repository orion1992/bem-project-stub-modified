# bem-project-stub-modified
Original project stub:
https://github.com/bem/project-stub

## BEFORE WORK START YOU MUST DO THIS:

<pre>npm install --save-dev</pre>
<pre>gulp prepare</pre>


## Modified features:

### to switch between merged and non-merged bundle:

#### run merged bundle:

<pre>npm run prod</pre>

#### merged CSS/JS connect example:
<pre>
styles: { elem: 'css', url: '../_merged/_merged.css' }
scripts: { elem: 'css', url: '../_merged/_merged.js' }
</pre>

#### run non-merged bundle:

<pre>npm start</pre>

#### non-merged CSS/JS connect example:
<pre>
styles: { elem: 'css', url: 'index.min.css' }
scripts: { elem: 'js', url: 'index.min.js' },
</pre>

### SWITCH SASS&&SCSS||STYLUS||POSTCSS

<pre>
gulp switch
</pre>
And then prompt ask you what a preprocessor u wanna choose. 
#### Note:Answer variants ( sass || styl || pcss )
