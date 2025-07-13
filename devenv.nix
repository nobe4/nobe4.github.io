{ pkgs, ... }:

{
  packages = with pkgs; [
    hugo
    dart-sass
  ];

  scripts.serve.exec = "hugo serve";
}
