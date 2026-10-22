//! Regular expressions in Rich's notation (section 6.1 of the textbook).
//!
//! Syntax: `∅` (no strings), `ε` (the empty string), a symbol of the alphabet, two
//! expressions side by side (concatenation), `α∪β` (union), `α*` (zero or more), `α+` (one or
//! more, the same as `αα*`) and parentheses. Precedence, highest first: star and plus,
//! concatenation, union. Spaces are ignored. If every symbol of the alphabet has one
//! character, each character is a symbol; otherwise symbols are separated by spaces or
//! operators, for example `(num plus)* num`.

use crate::fsm::{Alphabet, SymbolId};
use crate::message::Message;

/// The longest regular expression that is parsed, in characters.
pub const MAX_REGEX_CHARS: usize = 1_000;
/// The deepest nesting of parentheses.
pub const MAX_REGEX_DEPTH: usize = 100;

const OPERATORS: [char; 7] = ['(', ')', '*', '+', '∪', 'ε', '∅'];

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Regex {
    /// `∅`
    Empty,
    /// `ε`
    Epsilon,
    Symbol(SymbolId),
    Union(Box<Regex>, Box<Regex>),
    Concat(Box<Regex>, Box<Regex>),
    Star(Box<Regex>),
    Plus(Box<Regex>),
}

fn one_character_symbols(alphabet: &Alphabet) -> bool {
    alphabet.names().iter().all(|s| s.chars().count() == 1)
}

impl Regex {
    /// The expression in Rich's notation, with only the parentheses that are needed.
    pub fn to_text(&self, alphabet: &Alphabet) -> String {
        let mut out = String::new();
        write(
            self,
            alphabet,
            !one_character_symbols(alphabet),
            0,
            &mut out,
        );
        out
    }
}

/// `min_level` is how tightly the context binds: 0 union, 1 concatenation, 2 star and plus, 3 atom.
fn write(r: &Regex, alphabet: &Alphabet, spaced: bool, min_level: u8, out: &mut String) {
    let level = match r {
        Regex::Union(..) => 0,
        Regex::Concat(..) => 1,
        Regex::Star(_) | Regex::Plus(_) => 2,
        _ => 3,
    };
    let parenthesize = level < min_level;
    if parenthesize {
        out.push('(');
    }
    match r {
        Regex::Empty => out.push('∅'),
        Regex::Epsilon => out.push('ε'),
        Regex::Symbol(id) => out.push_str(alphabet.name(*id).unwrap_or("?")),
        Regex::Union(a, b) => {
            write(a, alphabet, spaced, 0, out);
            out.push('∪');
            write(b, alphabet, spaced, 0, out);
        }
        Regex::Concat(a, b) => {
            write(a, alphabet, spaced, 1, out);
            if spaced {
                out.push(' ');
            }
            write(b, alphabet, spaced, 1, out);
        }
        Regex::Star(a) => {
            write(a, alphabet, spaced, 2, out);
            out.push('*');
        }
        Regex::Plus(a) => {
            write(a, alphabet, spaced, 2, out);
            out.push('+');
        }
    }
    if parenthesize {
        out.push(')');
    }
}

#[derive(Debug, Clone, PartialEq)]
enum Token {
    Open,
    Close,
    Star,
    Plus,
    Union,
    Epsilon,
    Empty,
    Symbol(SymbolId),
}

struct Tok {
    token: Token,
    /// Characters from the start of the text.
    position: usize,
    text: String,
}

fn operator(c: char) -> Option<Token> {
    Some(match c {
        '(' => Token::Open,
        ')' => Token::Close,
        '*' => Token::Star,
        '+' => Token::Plus,
        '∪' => Token::Union,
        'ε' => Token::Epsilon,
        '∅' => Token::Empty,
        _ => return None,
    })
}

fn symbol_token(
    name: &str,
    position: usize,
    alphabet: &Alphabet,
    out: &mut Vec<Tok>,
) -> Result<(), Message> {
    let id = alphabet.id(name).ok_or_else(|| {
        Message::new("regex.unknown_symbol")
            .with("symbol", name)
            .with("position", position)
    })?;
    out.push(Tok {
        token: Token::Symbol(id),
        position,
        text: name.to_owned(),
    });
    Ok(())
}

fn lex(text: &str, alphabet: &Alphabet) -> Result<Vec<Tok>, Message> {
    let single = one_character_symbols(alphabet);
    let mut out = Vec::new();
    let mut run: Option<(usize, String)> = None;
    for (i, c) in text.chars().enumerate() {
        let op = operator(c);
        if (c.is_whitespace() || op.is_some())
            && let Some((start, name)) = run.take()
        {
            symbol_token(&name, start, alphabet, &mut out)?;
        }
        if c.is_whitespace() {
            continue;
        }
        if let Some(token) = op {
            out.push(Tok {
                token,
                position: i,
                text: c.to_string(),
            });
        } else if single {
            symbol_token(&c.to_string(), i, alphabet, &mut out)?;
        } else {
            run.get_or_insert((i, String::new())).1.push(c);
        }
    }
    if let Some((start, name)) = run {
        symbol_token(&name, start, alphabet, &mut out)?;
    }
    Ok(out)
}

struct Parser {
    tokens: Vec<Tok>,
    next: usize,
    end: usize,
}

impl Parser {
    fn peek(&self) -> Option<&Token> {
        self.tokens.get(self.next).map(|t| &t.token)
    }

    fn starts_atom(&self) -> bool {
        matches!(
            self.peek(),
            Some(Token::Symbol(_) | Token::Epsilon | Token::Empty | Token::Open)
        )
    }

    fn union(&mut self, depth: usize) -> Result<Regex, Message> {
        let mut left = self.concat(depth)?;
        while self.peek() == Some(&Token::Union) {
            self.next += 1;
            let right = self.concat(depth)?;
            left = Regex::Union(Box::new(left), Box::new(right));
        }
        Ok(left)
    }

    fn concat(&mut self, depth: usize) -> Result<Regex, Message> {
        let mut left = self.postfix(depth)?;
        while self.starts_atom() {
            let right = self.postfix(depth)?;
            left = Regex::Concat(Box::new(left), Box::new(right));
        }
        Ok(left)
    }

    fn postfix(&mut self, depth: usize) -> Result<Regex, Message> {
        let mut atom = self.atom(depth)?;
        loop {
            match self.peek() {
                Some(Token::Star) => atom = Regex::Star(Box::new(atom)),
                Some(Token::Plus) => atom = Regex::Plus(Box::new(atom)),
                _ => return Ok(atom),
            }
            self.next += 1;
        }
    }

    fn atom(&mut self, depth: usize) -> Result<Regex, Message> {
        let Some(tok) = self.tokens.get(self.next) else {
            return Err(Message::new("regex.unexpected_end").with("position", self.end));
        };
        let position = tok.position;
        let atom = match &tok.token {
            Token::Symbol(id) => Regex::Symbol(*id),
            Token::Epsilon => Regex::Epsilon,
            Token::Empty => Regex::Empty,
            Token::Open => {
                if depth >= MAX_REGEX_DEPTH {
                    return Err(Message::new("regex.too_deep").with("limit", MAX_REGEX_DEPTH));
                }
                self.next += 1;
                let inner = self.union(depth + 1)?;
                if self.peek() != Some(&Token::Close) {
                    return Err(
                        Message::new("regex.unbalanced_parenthesis").with("position", position)
                    );
                }
                inner
            }
            _ => {
                return Err(Message::new("regex.unexpected")
                    .with("found", tok.text.as_str())
                    .with("position", position));
            }
        };
        self.next += 1;
        Ok(atom)
    }
}

/// Parses `text` over `alphabet`. Errors carry the position (in characters from the start).
/// Returns an error if a symbol of the alphabet contains an operator character, because the
/// text would then be ambiguous.
pub fn parse_regex(text: &str, alphabet: &Alphabet) -> Result<Regex, Message> {
    if let Some(name) = alphabet
        .names()
        .iter()
        .find(|n| n.chars().any(|c| OPERATORS.contains(&c)))
    {
        return Err(Message::new("regex.operator_symbol").with("symbol", name.as_str()));
    }
    let length = text.chars().count();
    if length > MAX_REGEX_CHARS {
        return Err(Message::new("regex.too_long").with("limit", MAX_REGEX_CHARS));
    }
    let tokens = lex(text, alphabet)?;
    if tokens.is_empty() {
        return Err(Message::new("regex.empty"));
    }
    let mut parser = Parser {
        tokens,
        next: 0,
        end: length,
    };
    let regex = parser.union(0)?;
    match parser.tokens.get(parser.next) {
        None => Ok(regex),
        Some(tok) if tok.token == Token::Close => {
            Err(Message::new("regex.unbalanced_parenthesis").with("position", tok.position))
        }
        Some(tok) => Err(Message::new("regex.unexpected")
            .with("found", tok.text.as_str())
            .with("position", tok.position)),
    }
}
