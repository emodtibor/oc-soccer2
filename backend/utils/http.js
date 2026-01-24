const asyncHandler = fn => {
    if (typeof fn !== "function") {
        throw new TypeError(`asyncHandler expected a function, got ${typeof fn}`);
    }
    return (req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
}
module.exports = { asyncHandler };
