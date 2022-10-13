
/**
 * Writes the raw body buffer to the request object rawBody property. This way if support for Request.rawBody 
 * is discontinued, it wouldn't break anything.
 * @param req 
 * @param res 
 * @param buf 
 * @param encoding 
 */
 const rawBodySaver =  (req, res, buf, encoding) =>{
    if (buf && buf.length) {
      req.rawBody = buf.toString(encoding || 'utf8');
    }
  }



export default rawBodySaver
  