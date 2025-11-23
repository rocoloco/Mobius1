# Figma MCP Setup Guide
## US to Spain Migration Consumer UI

This guide will help you set up Figma MCP integration for the design phase of this project.

## Prerequisites

- **Figma Desktop App** installed (download from https://www.figma.com/downloads/)
- Figma account (free or paid)
- Node.js installed

## Step 1: Install Figma Desktop

1. Download Figma Desktop from https://www.figma.com/downloads/
2. Install and launch the application
3. Sign in to your Figma account

## Step 2: Enable MCP Server in Figma Desktop

1. Open Figma Desktop
2. Go to **Settings** (gear icon or File → Settings)
3. Look for **"Model Context Protocol"** or **"MCP Server"** section
4. **Enable the MCP server**
5. Note the server path (usually `C:\Users\[USERNAME]\AppData\Local\Figma\mcp-server\index.js` on Windows)

## Step 3: Get Your Figma Personal Access Token

1. Go to [Figma Account Settings](https://www.figma.com/settings)
2. Scroll down to "Personal access tokens"
3. Click "Create a new personal access token"
4. Give it a name like "Kiro MCP Integration"
5. Select scopes: **File content (read)** and **File content (write)**
6. Copy the token (you won't be able to see it again!)

## Step 4: Configure MCP Settings

The Figma MCP server has been configured in `.kiro/settings/mcp.json` to use Figma Desktop's local server:

```json
{
  "mcpServers": {
    "figma": {
      "url": "http://127.0.0.1:3845/mcp",
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

**No additional configuration needed!** The local server handles authentication through Figma Desktop.

## Step 5: Restart Kiro

After configuring the MCP settings, restart Kiro to load the Figma MCP server.

## Step 6: Verify Connection

Once Kiro restarts, the Figma MCP server should connect automatically. Check the MCP logs for:
- ✅ `[figma] MCP server connected`
- ❌ If you see errors, check the troubleshooting section below

## Step 7: Create Figma File

You can either:

**Option A: Create a new Figma file manually**
1. Open Figma Desktop
2. Click "New design file"
3. Name it "US to Spain Migration Consumer UI"
4. Copy the file URL or file key

**Option B: Use Figma MCP to create a file**
Once the MCP server is running, you can ask Kiro to create a Figma file for you.

## What's Next?

Once Figma MCP is set up, we'll proceed with:

1. **Task 1.2**: Create low-fidelity wireframes for all major pages
2. **Task 1.3**: Define color palette and branding
3. **Task 1.4**: Create high-fidelity mockups with approved branding

## Figma MCP Capabilities

The Figma MCP integration allows Kiro to:

- ✅ Create and modify Figma designs programmatically
- ✅ Generate frames, shapes, text, and components
- ✅ Export designs as images for documentation
- ✅ Organize designs with pages and frames
- ✅ Create reusable component libraries
- ✅ Extract design tokens (colors, typography, spacing)

## Troubleshooting

### Figma Desktop Not Installed
- Download from https://www.figma.com/downloads/
- Install and launch before configuring MCP

### MCP Server Not Found
- Open Figma Desktop settings
- Enable the MCP server feature
- Verify the server path in your file system
- Common path: `C:\Users\[USERNAME]\AppData\Local\Figma\mcp-server\index.js`

### Token Not Working
- Make sure you copied the entire token
- Check that there are no extra spaces in the MCP config
- Verify the token hasn't expired
- Ensure you selected the correct scopes (File content read/write)

### MCP Server Not Starting
- Check that Node.js is installed: `node --version`
- Verify the path to `index.js` is correct
- Check the Kiro MCP logs for error messages
- Try running manually: `node "C:\Users\jfros\AppData\Local\Figma\mcp-server\index.js"`

### Connection Hanging
- Restart Figma Desktop
- Restart Kiro
- Check that Figma Desktop is running when Kiro starts

### Can't Access Figma File
- Make sure the file is not private
- Verify you have edit permissions
- Check that the file URL/key is correct

## Resources

- [Figma API Documentation](https://www.figma.com/developers/api)
- [Figma MCP Server](https://github.com/modelcontextprotocol/servers/tree/main/src/figma)
- [MCP Documentation](https://modelcontextprotocol.io/)

---

**Status**: Configuration complete, awaiting Figma token
**Next Task**: 1.2 - Create low-fidelity wireframes
