# VSCode Marketplace Publishing Guide

## Step 1: Create an Azure DevOps Account

1. Visit [Azure DevOps](https://dev.azure.com/)
2. If you don't have an account, click "Start free" to register.
3. After logging in, create a new Organization.

## Step 2: Create a Personal Access Token (PAT)

1. After logging into Azure DevOps, click on your user avatar in the top right corner.
2. Select **"Personal access tokens"**.
3. Click **"+ New Token"**.
4. Configure the Token:
   - **Name**: Enter a name, e.g., "VSCode Extension Publishing".
   - **Organization**: Select "All accessible organizations".
   - **Expiration**: Set an expiration time (1 year recommended).
   - **Scopes**: 
     - Select **"Custom defined"**.
     - Click **"Show all scopes"**.
     - Find the **"Marketplace"** section.
     - Check the **"Manage"** permission.
5. Click **"Create"**.
6. **IMPORTANT**: Copy the generated Token (it is only shown once; please save it securely).

## Step 3: Create a Publisher

Run the following in your project directory:

```bash
vsce create-publisher kejiqing
```

You will be prompted to enter:
- Personal Access Token (the PAT you just created)
- Publisher display name (e.g., "kejiqing")

## Step 4: Publish the Extension

```bash
vsce publish
```

Alternatively, use the Token directly:

```bash
vsce publish -p <your_PAT>
```

## Step 5: Verify the Publication

1. Visit the [VSCode Marketplace](https://marketplace.visualstudio.com/vscode).
2. Search for your extension name.
3. Confirm that the extension has been successfully published.

## Subsequent Updates

After updating the version number, simply run:

```bash
vsce publish
```

## Precautions

- Ensure the `version` field in `package.json` is updated.
- Ensure the `publisher` field matches the created publisher name.
- After the initial publication, the extension will appear in the marketplace within a few minutes.
- When updating the extension, the version number must be incremented.

## FAQ

**Q: What if I forget to save the Token?**
A: You will need to delete the old Token and create a new one.

**Q: How do I update a published extension?**
A: Update the version number in `package.json`, then run `vsce publish`.

**Q: Can I unpublish?**
A: It cannot be completely retracted, but you can publish a new version to fix issues.
