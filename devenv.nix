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
    hugo serve --bind 0.0.0.0 --baseURL=http://0.0.0.0:1313/ --minify --buildDrafts
  '';
  scripts.build.exec = "hugo build --minify";
  scripts.format.exec = "prettier -w .";
  scripts.new.exec = ''
    name="''${1:?provide a name}"
    file="content/posts/$(date +%F)-''${name// /-}.md"
    hugo new content "$file"
    $EDITOR "$file"
  '';

  git-hooks.hooks.prettier = {
    enable = true;
  };
}
