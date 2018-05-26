/** Turns a function that has a (error, result) callback as last argument into a promise. */
export function promisify<T>(this: any, fun: Function) : (...args: any[]) => Promise<T>
{
	const _this = this;
	return (...args: any[]) =>
	{
		while (args.length < fun.length - 1)
			args.push(undefined);
		
		return new Promise<T>((resolve, reject) =>
		{
			fun.apply(_this, [...args, (error: any, result: T) =>
			{
				if (error)
					reject(error);
				else
					resolve(result);
			}]);
		});
	};
}


/**
 * Promise-based timeout function.
 * @param ms Timeout in milliseconds.
 */
export function delay(ms: number): Promise<void>
{
	return new Promise(res => setTimeout(res, ms));
}