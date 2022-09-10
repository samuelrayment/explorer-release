import * as core from '@actions/core'
import * as github from '@actions/github'
import {wait} from './wait'
import {PushEvent} from '@octokit/webhooks-types'
import { Endpoints } from "@octokit/types";

type ActionInput = {
    token: string,
}

type CommitTime = {
    timestamp: number,
    sha: string,
}

type MessageBody = {
    commits: CommitTime[],
    pushedAt: number,
}

function getInputs(): ActionInput {
    const token = core.getInput('github-token', {required: true})

    return {
	token
    }
}

function mapCommitToCommitTime(apiRoot: string, commit: any): CommitTime {
    const author = commit.author || null;
    let { date: parsedDate = 0 }: { date?: string | number } = author ?? {};
    if (typeof parsedDate === "string") {
	parsedDate = Date.parse(parsedDate) ?? 0;
    }	
    const timestamp: number = (typeof parsedDate == "string" ? 0 : parsedDate) / 1000;
    return {
	timestamp,
	sha: commit['url'].replace(apiRoot, '')
    };
}

async function run(): Promise<void> {
    const inputs = getInputs();
    const octokit = github.getOctokit(inputs.token);
    const context = github.context;
    const event = context.payload as PushEvent;
    const apiRoot = `https://api.github.com/repos/${context.repo.owner}/${context.repo.repo}/commits/`;

    
    const commitResponse: Endpoints['GET /repos/{owner}/{repo}/compare/{basehead}']['response'] = await octokit.request('GET /repos/{owner}/{repo}/compare/{basehead}', {
	owner: context.repo.owner,
	repo: context.repo.repo,
	basehead: `${event.before}...${event.after}`
    });
    console.log(commitResponse);
    const commitTimes: CommitTime[] = commitResponse['data']['commits'].map((i) => {
	return mapCommitToCommitTime(apiRoot, i);
    });
    const rawPushedAt = event.repository.pushed_at;
    let pushedAt = 0;
    if (typeof rawPushedAt === 'number') {
	pushedAt = rawPushedAt;
    }
    
    const messageBody: MessageBody = {
	commits: commitTimes,
	pushedAt
    };
    console.log(messageBody);
}

run()
