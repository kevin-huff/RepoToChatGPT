const { Octokit } = require("@octokit/rest");
const fs = require("fs");
const axios = require('axios');
require('dotenv').config();

const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN, // Add your GitHub Token in .env file
});

async function getFileContent(owner, repo, path) {
    console.log(`Fetching: ${path}`);
    const { data } = await octokit.repos.getContent({ owner, repo, path });
    const fileContent = Buffer.from(data.content, 'base64').toString();
    return { path: path, content: fileContent };
}

async function processDirectory(owner, repo, path) {
    console.log(`Checking directory: ${path}`);
    const dirData = await octokit.repos.getContent({ owner, repo, path });
    return Promise.all(dirData.data.map(file => {
        if (file.type === 'dir') {
            return processDirectory(owner, repo, file.path);
        } else {
            return getFileContent(owner, repo, file.path);
        }
    }));
}

async function getRepoContent(owner, repo) {
    const initialData = await octokit.repos.getContent({ owner, repo, path: '' });

    const results = await Promise.all(initialData.data.map(file => {
        if (file.type === 'dir') {
            return processDirectory(owner, repo, file.path);
        } else {
            return getFileContent(owner, repo, file.path);
        }
    }));

    return [].concat(...results);
}

async function main(owner, repo, docUrl) {
    let docContent = '';
    
    if (docUrl) {
        const docResponse = await axios.get(docUrl);
        docContent = "\n'''\n" + "Documentation" + "\n'''\n" + docResponse.data;
    }
    
    const repoContent = await getRepoContent(owner, repo);
    let repoData = repoContent.map(file => "\n'''\n" + file.path + "\n'''\n" + file.content).join('\n\n');
    
    //append repo data to doc content and save in text file
    fs.writeFileSync(`${owner}_${repo}_output.txt`, docContent + repoData);
}

let rateLimitResetTime = null;
setInterval(async () => {
    const rateLimitStatus = await octokit.rateLimit.get();
    const { limit, remaining, reset } = rateLimitStatus.data.resources.core;
    rateLimitResetTime = new Date(reset * 1000);

    if (remaining <= 50) {
        console.log("Almost reaching rate limit. Pausing until rate limit resets.");
        while (reset > Date.now()) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        console.log("Resuming...");
    }
}, 1000);

// Call main function with parameters Github owner, repo, and a docUrl
main(process.argv[2], process.argv[3], process.argv[4]);  // Replace 'github', 'hub', and 'docUrl' with your Github username, repo name, and documentation URL respectively.