{ pkgs, ... }:

{
  packages = with pkgs; [
    hugo
    dart-sass
    typescript-language-server
  ];

  languages.javascript.enable = true;
  languages.javascript.npm.install.enable = true;

  scripts.serve.exec = "hugo serve --bind 0.0.0.0 --baseURL=http://0.0.0.0:1313/ --minify";
  scripts.format.exec = "prettier -w .";
}
