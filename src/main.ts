import * as core from '@actions/core'
import * as github from '@actions/github'
import {PushEvent} from '@octokit/webhooks-types'
import { Endpoints } from "@octokit/types";
import * as http from '@actions/http-client';

export type ActionInput = {
    token: string,
    endpoint: string,
    secretKey: string
}

type CommitTime = {
    timestamp: number,
    sha: string,
}

type MessageBody = {
    commits: CommitTime[],
    pushedAt: number,
}

export type CompareResponse = {
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

export type MinimalPushEvent = {
    pushed_at: number | string | null,
    before: string,
    after: string
}

type ActionContext = {
    repoOwner: string,
    repoName: string,
    apiRoot: string
}

type Octokit = ReturnType<typeof github.getOctokit>

function getInputs(): ActionInput {
    const token = core.getInput('github-token', {required: true});
    const endpoint = core.getInput('explorer-endpoint', {required: true});
    const secretKey = core.getInput('secret-key', {required: true});

    return {
	token,
	endpoint,
	secretKey
    }
}

function mapCommitToCommitTime(actionContext: ActionContext,
			       commit: CommitResponse): CommitTime {
    let { date: parsedDate = "" } = commit.author;
    const timestamp: number = (Date.parse(parsedDate) ?? 0) / 1000;
    return {
	timestamp,
	sha: commit.url.replace(actionContext.apiRoot, '')
    };
}

function fetchCommits(octokit: Octokit, actionContext: ActionContext,
		      before: string, after: string): AsyncIterable<CompareResponse> {
    return octokit.paginate.iterator('GET /repos/{owner}/{repo}/compare/{basehead}', {
    	owner: actionContext.repoOwner,
    	repo: actionContext.repoName,
    	basehead: `${before}...${after}`,
	per_page: 100
    }) as AsyncIterable<CompareResponse>;
}

async function fetchCommitTimes(octokit: Octokit, actionContext: ActionContext,
				before: string, after: string): Promise<CommitTime[]> {
    const iterator = fetchCommits(octokit, actionContext, before, after);
    let commitTimes: CommitTime[] = [];
    for await (const { data: { commits } } of iterator) {
    	for (const commitWrapper of commits) {
    	    commitTimes.push(mapCommitToCommitTime(actionContext,
						   commitWrapper.commit));
    	}
    }
    return commitTimes;
}

function getPushedAt(event: MinimalPushEvent): number {
    const rawPushedAt = event.pushed_at;
    let pushedAt = 0;
    if (typeof rawPushedAt === 'number') {
	pushedAt = rawPushedAt;
    }
    return pushedAt;
}

async function publishPushEventToExplorer(client: http.HttpClient,
					  inputs: ActionInput,
					  messageBody: MessageBody) {
    console.log(messageBody);
    let response = client.post(
	inputs.endpoint,
	JSON.stringify(messageBody)
    )
    console.log(response);
}

export async function processPushEvent(event: MinimalPushEvent,
				       client: http.HttpClient) {
    const context = github.context;
    const apiRoot = `https://api.github.com/repos/${context.repo.owner}/${context.repo.repo}/git/commits/`;
    const actionContext = {
	apiRoot,
	repoOwner: context.repo.owner,
	repoName: context.repo.repo
    };
    
    const inputs = getInputs();
    const octokit = github.getOctokit(inputs.token);

    const commitTimes = await fetchCommitTimes(octokit, actionContext,
					       event.before, event.after);
    const pushedAt = getPushedAt(event);
    
    const messageBody = {
	commits: commitTimes,
	pushedAt
    };
    await publishPushEventToExplorer(client, inputs, messageBody);    
}

async function run(): Promise<void> {
    try {
	const event = github.context.payload as PushEvent;
	const minimalEvent = {
	    before: event.before,
	    after: event.after,
	    pushed_at: event.repository.pushed_at
	};
	const client = new http.HttpClient();
	await processPushEvent(minimalEvent, client);
    } catch (error: unknown) {
        core.info((error as Error).message);
    }
}

run()
