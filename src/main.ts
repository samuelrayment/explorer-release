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

type CompareResponse = {
    data: CommitsResponseData
}

type CommitsResponseData = {
    commits: CommitWrapperResponse[]
}

type CommitWrapperResponse = {
    commit: CommitResponse
}

type CommitResponse = {
    author: CommitAuthor,
    url: string
}

type CommitAuthor = {
    date: string
}

function getInputs(): ActionInput {
    const token = core.getInput('github-token', {required: true})

    return {
	token
    }
}

function mapCommitToCommitTime(apiRoot: string, commit: CommitResponse): CommitTime {
    const author = commit.author;
    let { date: parsedDate = "" } = author;
    //if (typeof parsedDate === "string") {
    const timestamp: number = Date.parse(parsedDate) ?? 0;
    //}	
    //const timestamp: number = (typeof parsedDate == "string" ? 0 : parsedDate) / 1000;
    return {
	timestamp,
	sha: commit.url.replace(apiRoot, '')
    };
}

async function run(): Promise<void> {
    const inputs = getInputs();
    const octokit = github.getOctokit(inputs.token);
    const context = github.context;
    const event = context.payload as PushEvent;
    const apiRoot = `https://api.github.com/repos/${context.repo.owner}/${context.repo.repo}/git/commits/`;

    
    const iterator = octokit.paginate.iterator('GET /repos/{owner}/{repo}/compare/{basehead}', {
    	owner: context.repo.owner,
    	repo: context.repo.repo,
    	basehead: `${event.before}...${event.after}`,
	per_page: 100
    }) as AsyncIterable<CompareResponse>;
    let commitTimes: CommitTime[] = [];
    for await (const { data: { commits } } of iterator) {
    	for (const commitWrapper of commits) {
    	    commitTimes.push(mapCommitToCommitTime(apiRoot, commitWrapper.commit));
    	}
    }
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
