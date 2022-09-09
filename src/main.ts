import * as core from '@actions/core'
import * as github from '@actions/github'
import {wait} from './wait'
import {PushEvent} from '@octokit/webhooks-types'

type ActionInput = {
    token: string,
}

function getInputs(): ActionInput {
    const token = core.getInput('github-token', {required: true})

    return {
	token
    }
}

async function run(): Promise<void> {
    const inputs = getInputs();
    const octokit = github.getOctokit(inputs.token);
    const context = github.context;
    const event = context.payload as PushEvent;

    console.log(event.before);
    console.log(event.after);
    console.log(inputs.token);
    const commits = await octokit.request('GET /repos/{owner}/{repo}/compare/{basehead}', {
	owner: context.repo.owner,
	repo: context.repo.repo,
	basehead: `${event.before}...${event.after}`
    });
    console.log(commits);
}

run()
