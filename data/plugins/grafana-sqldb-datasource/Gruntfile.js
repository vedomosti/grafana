module.exports = function(grunt) {
  require('load-grunt-tasks')(grunt);

  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-typescript');

  grunt.initConfig({
    clean: ['src_gen', 'dist'],

    copy: {
      src_js: {
        expand: true,
        cwd: 'src',
        src: ['**/*.js', '**/*.ts', '**/*.d.ts'],
        dest: 'src_gen/'
      },

      dist_js: {
        expand: true,
        flatten: true,
        cwd: 'src_gen/public/',
        src: ['*.js', '*.ts', '*.d.ts', '*.js.map'],
        dest: 'dist/'
      },
      dist_html: {
        expand: true,
        flatten: true,
        cwd: 'src/public/partials',
        src: ['*.html'],
        dest: 'dist/partials/'
      },
      dist_statics: {
        expand: true,
        src: ['plugin.json', 'LICENSE', 'NOTICE'],
        dest: 'dist/'
      }
    },

    typescript: {
      build: {
        src: ['src_gen/**/*.ts', '!**/*.d.ts'],
        out: 'dist',
        options: {
          module: 'system',
          target: 'es5',
          declaration: true,
          emitDecoratorMetadata: true,
          experimentalDecorators: true,
          sourceMap: true,
          noImplicitAny: false,
        }
      }
    }
  });

  grunt.registerTask('default', [
    'clean',
    'copy:src_js',
    'typescript:build',
    'copy:dist_js',
    'copy:dist_html',
    'copy:dist_statics'
  ]);
};
