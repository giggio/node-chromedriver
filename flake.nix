{
  description = "node-chromedriver";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs {
          inherit system;
          overlays = [ ];
        };
      in
      {
        devShells.default = pkgs.mkShell {
          nativeBuildInputs = with pkgs.buildPackages; [
            nodejs_26
          ];
        };
      }
    );
}
