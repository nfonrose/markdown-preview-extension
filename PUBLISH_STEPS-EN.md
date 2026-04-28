# Quick Publishing Steps

## 1. Create a Personal Access Token

1. Visit https://dev.azure.com/ and log in.
2. Click on the avatar in the top right → **Personal access tokens**.
3. Click **"+ New Token"**.
4. Settings:
   - Name: `VSCode Extension Publishing`
   - Organization: `All accessible organizations`
   - Scopes: Select **Custom defined** → **Show all scopes** → Find **Marketplace** → Check **Manage**
5. Click **Create** and copy the Token (it is only shown once).

## 2. Create a Publisher

```bash
vsce create-publisher kejiqing
```

Enter the Token you just copied.

## 3. Publish the Extension

```bash
vsce publish
```

Alternatively, use the Token directly:

```bash
vsce publish -p <your_PAT>
```

## 4. Verification

Visit https://marketplace.visualstudio.com/vscode and search for your extension.

## Update Version

Modify the `version` field in `package.json`, then run:

```bash
vsce publish
```
