/**
 * Decorator for a get-only property to turn it into a automatically caching property.
 */
export const lazy = (target: any, propertyKey: string | symbol, propertyDescriptor: PropertyDescriptor) =>
{
	const defineHidden = (target: any, key: string) =>
		Object.defineProperty(target, key, {
			writable: true,
			enumerable: false,
		});

	const valueKey = `__${String(propertyKey)}_value`;
	const hasValueKey = `__${String(propertyKey)}_has_value`;

	return <PropertyDescriptor>{
		get: function(this: any)
		{
			if (this[hasValueKey] !== true)
			{
				defineHidden(this, valueKey);
				defineHidden(this, hasValueKey);

				this[valueKey] = propertyDescriptor.get!.bind(this)();
				this[hasValueKey] = true;
			}
			
			return this[valueKey];
		}
	};
}