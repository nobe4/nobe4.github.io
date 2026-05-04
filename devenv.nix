{ pkgs, ... }:

{
  packages = with pkgs; [
    hugo
    dart-sass
    typescript-language-server
    marksman
    vale-ls
    vscode-css-languageserver
  ];

  languages.javascript = {
    enable = true;
    npm.enable = true;
    npm.install.enable = true;
  };

  scripts.serve.exec = ''
    open http://0.0.0.0:1313
    hugo serve --bind 0.0.0.0 --baseURL=http://0.0.0.0:1313/ --minify
  '';
  scripts.build.exec = "hugo build --minify";
  scripts.format.exec = "prettier -w .";

  git-hooks.hooks.prettier = {
    enable = true;
  };
}
